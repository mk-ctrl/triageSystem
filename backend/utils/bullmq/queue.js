import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Create an IORedis connection
const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
});

// Export the queue instance
export const ticketQueue = new Queue('ticketQueue', {
    connection,
});
