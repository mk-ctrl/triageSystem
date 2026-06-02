import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Create an IORedis connection for the worker
const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
});

// Export the worker instance so it's initialized when imported
export const ticketWorker = new Worker(
    'ticketQueue',
    async (job) => {
        // Here we handle the job logic. For now, we simulate backend assignment/processing
        const { ticketId } = job.data;
        console.log(`[Worker] Picked up job ${job.id} for ticket ID: ${ticketId}`);
        
        // Simulate heavy processing / routing logic here
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`[Worker] Successfully processed ticket ID: ${ticketId}`);
        return { status: 'completed', assignedTo: 'backend-agent' };
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
