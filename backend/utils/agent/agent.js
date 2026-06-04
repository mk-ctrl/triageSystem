
import { InferenceClient } from "@huggingface/inference";
import "dotenv/config";

const client = new InferenceClient(process.env.HF_TOKEN);

function parseAiResponse(rawAiText) {
  try {
    // 1. Strip the markdown code block wrappers using regex
    let cleanedText = rawAiText
      .replace(/```json\s*/gi, '') // Remove opening ```json
      .replace(/```\s*/g, '')      // Remove closing ```
      .trim();                     // Remove extra whitespace

    // 1b. DeepSeek sometimes drops the opening brace. Repair it if missing.
    if (!cleanedText.startsWith('{') && cleanedText.includes('"category"')) {
        cleanedText = '{\n' + cleanedText;
    }

    // 2. Safely parse the clean string
    return JSON.parse(cleanedText);
    
  } catch (error) {
    console.error("AI returned malformed JSON:", rawAiText);
    throw new Error("Failed to parse AI classification");
  }
}

/**
 * Parses, classifies, and structures the customer support ticket text into JSON.
 * @param {string} ticketText The raw text from the user.
 * @returns {Promise<{category: string, priority: string, sentiment: string, drafted_response: string}>}
 */
export async function classifyTicket(ticketText) {
    console.log("[Agent] Classifying ticket text...");
    
    const systemPrompt = `You are a customer support triage assistant.
Analyze the following customer support ticket and classify it.
Determine the 'category', 'priority', 'sentiment', and provide a 'drafted_response' to the customer.

Return ONLY a strict, valid JSON object matching this schema exactly. Do not include any conversational text or formatting.
{
  "category": "technical_bug | billing | account_issue | general",
  "priority": "low | medium | high | urgent",
  "sentiment": "happy | neutral | frustrated | angry",
  "drafted_response": "..."
}`;

    const chatCompletion = await client.chatCompletion({
        model: "deepseek-ai/DeepSeek-V4-Flash:featherless-ai",
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `Ticket:\n"${ticketText}"`,
            }
        ],
        max_tokens: 500,
        temperature: 0.1
    });

    const rawResponse = chatCompletion.choices[0].message.content;
    console.log("[Agent] Raw AI response received:", rawResponse);
    
    return parseAiResponse(rawResponse);
}

/**
 * Generates a 768-dimensional vector embedding for the given text.
 * @param {string} text The text to embed.
 * @returns {Promise<number[]>} The vector embedding array.
 */
export async function generateEmbedding(text) {
    console.log("[Agent] Generating embedding for text...");
    const embedding = await client.featureExtraction({
        model: "BAAI/bge-base-en-v1.5",
        inputs: text,
    });
    return embedding;
}