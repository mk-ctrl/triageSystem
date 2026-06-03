import { classifyTicket } from '../agent/agent.js';

/**
 * This function handles the specific business logic required to process a ticket.
 * It uses the Hugging Face LLM to classify the ticket's raw text into a structured JSON object.
 * 
 * @param {string|number} ticketId The ID of the ticket being processed
 * @param {string} rawText The raw text of the ticket to be classified
 */
export const processTicketTask = async (ticketId, rawText) => {
    console.log(`[Task Processor] Starting AI triage for ticket ID: ${ticketId}`);
    
    // Call the LLM API to categorize the ticket
    const classificationResult = await classifyTicket(rawText);
    
    console.log(`[Task Processor] Processing completed. AI Result:`, classificationResult);
    
    return classificationResult;
};
