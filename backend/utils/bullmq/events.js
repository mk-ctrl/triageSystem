import { QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { getIO } from '../socket/socket.js';
import { pool } from '../supabase/connectSupabase.js';
import { ticketQueue } from './queue.js';

dotenv.config();

// Create connection for QueueEvents
const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

/**
 * Initialize QueueEvents monitoring to bridge BullMQ states to Socket.io clients.
 */
export const initQueueEvents = () => {
    const queueEvents = new QueueEvents('ticketQueue', { connection });

    queueEvents.on('completed', async ({ jobId }) => {
        console.log(`[QueueEvents] Job ${jobId} completed. Fetching ticket details...`);
        try {
            // Retrieve job to read ticketId
            const job = await ticketQueue.getJob(jobId);
            if (!job) {
                console.error(`[QueueEvents] Job ${jobId} not found.`);
                return;
            }

            const { ticketId } = job.data;

            // Retrieve updated ticket record from Supabase
            const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
            if (rows.length === 0) {
                console.error(`[QueueEvents] Ticket ID ${ticketId} not found in database.`);
                return;
            }

            const updatedTicket = rows[0];

            // Emit the updated ticket data to all connected sockets
            const io = getIO();
            io.emit('ticket_resolved', updatedTicket);
            console.log(`[QueueEvents] Broadcasted ticket_resolved event for ticket ID: ${ticketId}`);
        } catch (error) {
            console.error('[QueueEvents] Error processing completed event:', error);
        }
    });

    queueEvents.on('failed', async ({ jobId, failedReason }) => {
        console.log(`[QueueEvents] Job ${jobId} failed. Reason: ${failedReason}`);
        try {
            const job = await ticketQueue.getJob(jobId);
            if (!job) return;

            const { ticketId } = job.data;
            
            // Retrieve failed ticket record
            const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
            if (rows.length === 0) return;

            const updatedTicket = rows[0];

            // Emit failure status to clients
            const io = getIO();
            io.emit('ticket_resolved', updatedTicket);
        } catch (error) {
            console.error('[QueueEvents] Error processing failed event:', error);
        }
    });

    console.log('⚡ BullMQ QueueEvents listener initialized.');
};
