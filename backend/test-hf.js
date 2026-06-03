import { classifyTicket } from './utils/agent/agent.js';

async function run() {
    console.log("Testing Hugging Face LLM Integration...");
    const sampleText = "Hey, I tried to pay yesterday but it threw a weird 500 error and now my dashboard is frozen, fix this ASAP!";
    try {
        const result = await classifyTicket(sampleText);
        console.log("\nClassification JSON successfully extracted:");
        console.log(JSON.stringify(result, null, 2));
    } catch(err) {
        console.error("\nTest failed:", err);
    }
}
run();
