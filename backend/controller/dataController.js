import { pool } from '../utils/supabase/connectSupabase.js';
import { ticketQueue } from '../utils/bullmq/queue.js';

/**
 * Controller to handle incoming data from the frontend and insert it into Supabase.
 * Assumes a table named 'triage_records' exists. You may need to update the table name
 * and column mappings based on your actual Supabase schema.
 */
export const insertData = async (req, res) => {
    try {
        const data = req.body;
        
        // Ensure there is data to insert
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'Request body is empty' });
        }

        // Dynamically create the query based on the object keys
        const keys = Object.keys(data);
        const values = Object.values(data);
        
        const columns = keys.map(key => `"${key}"`).join(', ');
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

        // Update 'tickets' to your actual table name
        const query = `INSERT INTO tickets (${columns}) VALUES (${placeholders}) RETURNING *`;
        
        const result = await pool.query(query, values);
        
        // Enqueue the new ticket ID into BullMQ for asynchronous processing
        if (result.rows && result.rows.length > 0) {
            const newTicketId = result.rows[0].id; // Assuming 'id' is the primary key column
            await ticketQueue.add('processTicket', { ticketId: newTicketId });
        }
        
        return res.status(201).json({
            message: 'Data successfully inserted into Supabase',
            record: result.rows[0]
        });

    } catch (error) {
        console.error('Error inserting data into Supabase:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
};
