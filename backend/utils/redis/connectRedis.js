import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();;

// 1. Declare client at the outer scope so it can be exported
const client = createClient({
    url: process.env.REDIS_URL,
});

// 2. Define your test function using that same client
export async function testRedisConnection() {
    try {
        await client.connect();
        console.log("Connected to Redis!");
    } catch (err) {
        console.error("Failed to connect:", err);
    }
}

