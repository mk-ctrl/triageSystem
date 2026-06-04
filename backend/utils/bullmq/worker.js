import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { pool } from '../supabase/connectSupabase.js';
import { processTicketTask } from './taskProcessor.js';
dotenv.config();

// Create an IORedis connection for the worker
const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
});

// Export the worker instance so it's initialized when imported
export const ticketWorker = new Worker(
    'ticketQueue',
    async (job) => {
        const { ticketId } = job.data;
        console.log(`[Worker] Picked up job ${job.id} for ticket ID: ${ticketId}`);
        
        try {
            // 1. Mark as processing in DB and fetch raw_text
            const ticketResult = await pool.query(
                'UPDATE tickets SET status = $1 WHERE id = $2 RETURNING raw_text', 
                ['processing', ticketId]
            );

            if (ticketResult.rows.length === 0) {
                throw new Error(`Ticket ID ${ticketId} not found in database.`);
            }
            const rawText = ticketResult.rows[0].raw_text;

            // 2. Perform the heavy lifting task (AI classification or cache hit)
            const result = await processTicketTask(ticketId, rawText);
            
            // 3. Extract the drafted response, cache metrics, and save the rest to the JSONB column
            const { drafted_response, embedding, cacheHit, ...classification } = result;

            // 4. Mark as completed and save data in DB
            await pool.query(
                'UPDATE tickets SET status = $1, classification = $2, drafted_response = $3 WHERE id = $4', 
                ['completed', classification, drafted_response, ticketId]
            );

            // 5. If it was a cache miss, save the new embedding to enrich the semantic cache
            if (!cacheHit && embedding) {
                const embeddingString = `[${embedding.join(',')}]`;
                await pool.query(
                    'INSERT INTO ticket_embeddings (ticket_id, embedding) VALUES ($1, $2)',
                    [ticketId, embeddingString]
                );
                console.log(`[Worker] Saved new embedding for ticket ID: ${ticketId} to semantic cache`);
            }

            console.log(`[Worker] Successfully processed and updated ticket ID: ${ticketId}`);
            return result;
        } catch (error) {
            console.error(`[Worker] Error processing ticket ID: ${ticketId}`, error);
            // Optionally mark as failed in DB
            await pool.query('UPDATE tickets SET status = $1 WHERE id = $2', ['failed', ticketId]);
            throw error;
        }
    },
    {
        connection,
    }
);

// Event listeners for monitoring worker status
ticketWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} has completed!`);
});

ticketWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} has failed with error ${err.message}`);
});
