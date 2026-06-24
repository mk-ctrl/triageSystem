import { pool } from '../utils/supabase/connectSupabase.js';
import { ticketQueue } from '../utils/bullmq/queue.js';
import { getIO } from '../utils/socket/socket.js';

/**
 * Controller to handle incoming data from the frontend and insert it into Supabase.
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

        const query = `INSERT INTO tickets (${columns}) VALUES (${placeholders}) RETURNING *`;
        
        const result = await pool.query(query, values);
        
        // Enqueue the new ticket ID into BullMQ for asynchronous processing
        if (result.rows && result.rows.length > 0) {
            const newTicket = result.rows[0];
            const newTicketId = newTicket.id; // Assuming 'id' is the primary key column
            await ticketQueue.add('processTicket', { ticketId: newTicketId });

            // Emit ticket_new event to WebSocket clients
            try {
                const io = getIO();
                io.emit('ticket_new', newTicket);
            } catch (socketError) {
                console.error('Error emitting ticket_new WebSocket event:', socketError.message);
            }
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

/**
 * Fetch a single ticket by its UUID.
 */
export const getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching ticket:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
};

/**
 * Fetch all tickets with support for pagination and filtering.
 */
export const getTickets = async (req, res) => {
    try {
        const { status, customer_mail, category, priority, sentiment, limit = 10, page = 1 } = req.query;
        
        const parsedLimit = parseInt(limit, 10);
        const parsedPage = parseInt(page, 10);
        const offset = (parsedPage - 1) * parsedLimit;

        let queryText = 'SELECT * FROM tickets';
        let countQueryText = 'SELECT COUNT(*) FROM tickets';
        const conditions = [];
        const values = [];
        let paramIndex = 1;

        if (status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(status);
        }
        if (customer_mail) {
            conditions.push(`customer_mail = $${paramIndex++}`);
            values.push(customer_mail);
        }
        if (category) {
            conditions.push(`classification->>'category' = $${paramIndex++}`);
            values.push(category);
        }
        if (priority) {
            conditions.push(`classification->>'priority' = $${paramIndex++}`);
            values.push(priority);
        }
        if (sentiment) {
            conditions.push(`classification->>'sentiment' = $${paramIndex++}`);
            values.push(sentiment);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            queryText += whereClause;
            countQueryText += whereClause;
        }

        // Add ordering and pagination limits
        queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        
        // Execute count query (using filters slice for values)
        const countResult = await pool.query(countQueryText, values);
        const totalCount = parseInt(countResult.rows[0].count, 10);

        // Add pagination params to values array
        values.push(parsedLimit, offset);
        const result = await pool.query(queryText, values);

        return res.status(200).json({
            tickets: result.rows,
            pagination: {
                total: totalCount,
                limit: parsedLimit,
                page: parsedPage,
                pages: Math.ceil(totalCount / parsedLimit)
            }
        });
    } catch (error) {
        console.error('Error listing tickets:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
};

/**
 * Update/override ticket properties (status, drafted response, or classification).
 */
export const updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, drafted_response, classification } = req.body;

        // Verify ticket exists
        const checkRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const existingTicket = checkRes.rows[0];
        const updatedStatus = status !== undefined ? status : existingTicket.status;
        const updatedDraft = drafted_response !== undefined ? drafted_response : existingTicket.drafted_response;
        
        let updatedClassification = existingTicket.classification;
        if (classification !== undefined) {
            updatedClassification = {
                ...(existingTicket.classification || {}),
                ...classification
            };
        }

        const updateQuery = `
            UPDATE tickets 
            SET status = $1, drafted_response = $2, classification = $3 
            WHERE id = $4 
            RETURNING *
        `;
        const result = await pool.query(updateQuery, [updatedStatus, updatedDraft, updatedClassification, id]);

        return res.status(200).json({
            message: 'Ticket successfully updated',
            record: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating ticket:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
};

/**
 * Delete a ticket and its associated embeddings from the database.
 */
export const deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ticket exists
        const checkRes = await pool.query('SELECT id FROM tickets WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Perform transaction deletion
        await pool.query('BEGIN');
        await pool.query('DELETE FROM ticket_embeddings WHERE ticket_id = $1', [id]);
        await pool.query('DELETE FROM tickets WHERE id = $1', [id]);
        await pool.query('COMMIT');

        return res.status(200).json({ 
            message: 'Ticket and associated embeddings successfully deleted' 
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error deleting ticket:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
};

/**
 * Retrieve aggregated analytics and performance metrics for the triage system.
 */
export const getAnalytics = async (req, res) => {
    try {
        const generalStatsQuery = `
            SELECT 
              COUNT(*)::int as total_tickets,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int as completed,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int as pending,
              SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END)::int as processing,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int as failed
            FROM tickets
        `;
        
        const cacheStatsQuery = `
            SELECT 
              COUNT(*)::int as completed_count,
              SUM(CASE WHEN te.ticket_id IS NULL THEN 1 ELSE 0 END)::int as cache_hits,
              SUM(CASE WHEN te.ticket_id IS NOT NULL THEN 1 ELSE 0 END)::int as cache_misses
            FROM tickets t
            LEFT JOIN ticket_embeddings te ON t.id = te.ticket_id
            WHERE t.status = 'completed'
        `;

        const categoryStatsQuery = `
            SELECT classification->>'category' as category, COUNT(*)::int as count 
            FROM tickets 
            WHERE classification->>'category' IS NOT NULL 
            GROUP BY classification->>'category'
        `;

        const priorityStatsQuery = `
            SELECT classification->>'priority' as priority, COUNT(*)::int as count 
            FROM tickets 
            WHERE classification->>'priority' IS NOT NULL 
            GROUP BY classification->>'priority'
        `;

        const sentimentStatsQuery = `
            SELECT classification->>'sentiment' as sentiment, COUNT(*)::int as count 
            FROM tickets 
            WHERE classification->>'sentiment' IS NOT NULL 
            GROUP BY classification->>'sentiment'
        `;

        const [generalRes, cacheRes, categoryRes, priorityRes, sentimentRes] = await Promise.all([
            pool.query(generalStatsQuery),
            pool.query(cacheStatsQuery),
            pool.query(categoryStatsQuery),
            pool.query(priorityStatsQuery),
            pool.query(sentimentStatsQuery),
        ]);

        const general = generalRes.rows[0] || {};
        const cache = cacheRes.rows[0] || {};
        
        const totalTickets = general.total_tickets || 0;
        const completedTickets = general.completed || 0;
        const pendingTickets = general.pending || 0;
        const processingTickets = general.processing || 0;
        const failedTickets = general.failed || 0;

        const cacheHits = cache.cache_hits || 0;
        const cacheMisses = cache.cache_misses || 0;
        const cacheHitRate = completedTickets > 0 ? (cacheHits / completedTickets) : 0;

        // Format distributions as object maps
        const categories = {};
        categoryRes.rows.forEach(r => { if (r.category) categories[r.category] = r.count; });

        const priorities = {};
        priorityRes.rows.forEach(r => { if (r.priority) priorities[r.priority] = r.count; });

        const sentiments = {};
        sentimentRes.rows.forEach(r => { if (r.sentiment) sentiments[r.sentiment] = r.count; });

        return res.status(200).json({
            total_tickets: totalTickets,
            status_distribution: {
                pending: pendingTickets,
                processing: processingTickets,
                completed: completedTickets,
                failed: failedTickets
            },
            category_distribution: categories,
            priority_distribution: priorities,
            sentiment_distribution: sentiments,
            cache_metrics: {
                completed_tickets: completedTickets,
                cache_hits: cacheHits,
                cache_misses: cacheMisses,
                cache_hit_rate: parseFloat(cacheHitRate.toFixed(4))
            }
        });
    } catch (error) {
        console.error('Error generating analytics:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
};
