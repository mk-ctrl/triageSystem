import { pool } from '../supabase/connectSupabase.js';

async function run() {
    try {
        console.log("Checking similarity score...");
        const res = await pool.query(`
            SELECT 
              t1.raw_text as text1,
              t2.raw_text as text2,
              1 - (e1.embedding <=> e2.embedding) as similarity
            FROM ticket_embeddings e1
            JOIN ticket_embeddings e2 ON e1.ticket_id != e2.ticket_id
            JOIN tickets t1 ON t1.id = e1.ticket_id
            JOIN tickets t2 ON t2.id = e2.ticket_id
            WHERE t1.id = '014ec770-a79d-43d2-a0d4-239d079a1212' 
              AND t2.id = '7f18facb-99b8-4bc1-8ebb-ff74198ddfbe';
        `);
        console.table(res.rows);
        await pool.end();
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
