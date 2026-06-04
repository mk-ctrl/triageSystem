import { classifyTicket, generateEmbedding } from '../agent/agent.js';
import { pool } from '../supabase/connectSupabase.js';

/**
 * This function handles the specific business logic required to process a ticket.
 * It uses the Hugging Face LLM to classify the ticket's raw text, but first
 * checks a vector database cache to bypass the LLM if a similar ticket exists.
 * 
 * @param {string|number} ticketId The ID of the ticket being processed
 * @param {string} rawText The raw text of the ticket to be classified
 */
export const processTicketTask = async (ticketId, rawText) => {
    console.log(`[Task Processor] Starting AI triage for ticket ID: ${ticketId}`);
    
    // 1. Generate the semantic embedding for the new text
    const embeddingRaw = await generateEmbedding(rawText);
    const embedding = Array.isArray(embeddingRaw[0]) ? embeddingRaw[0] : embeddingRaw;
    const embeddingString = `[${embedding.join(',')}]`;
    
    // 2. Query the semantic cache
    console.log(`[Task Processor] Checking semantic cache...`);
    const { rows } = await pool.query(
        'SELECT * FROM match_tickets($1, $2, $3)',
        [embeddingString, 0.85, 1] // Search for 85% similarity
    );

    if (rows.length > 0) {
        const matchedTicketId = rows[0].ticket_id;
        const similarity = rows[0].similarity;
        console.log(`[Task Processor] Cache Hit! Matched ticket ${matchedTicketId} (Similarity: ${similarity.toFixed(2)}) - Bypassing LLM`);
        
        // Fetch the cached response and classification
        const matchedTicketResult = await pool.query(
            'SELECT classification, drafted_response FROM tickets WHERE id = $1',
            [matchedTicketId]
        );
        
        if (matchedTicketResult.rows.length > 0) {
             const cached = matchedTicketResult.rows[0];
             return {
                 ...cached.classification,
                 drafted_response: cached.drafted_response,
                 embedding,
                 cacheHit: true
             };
        }
    }

    console.log(`[Task Processor] Cache Miss. Calling LLM...`);
    
    // 3. Fallback: Call the LLM API to categorize the ticket
    const classificationResult = await classifyTicket(rawText);
    
    console.log(`[Task Processor] Processing completed. AI Result:`, classificationResult);
    
    return {
        ...classificationResult,
        embedding,
        cacheHit: false
    };
};
