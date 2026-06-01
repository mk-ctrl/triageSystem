import {Pool} from 'pg';
import dotenv from "dotenv";
dotenv.config();
const pool = new Pool({
    connectionString: process.env.SUPABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

export async function testSupabaseConnection() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log("Connected to Supabase!");
    } catch (err) {
        console.error("Failed to connect to Supabase:", err);
    }
}