# Triage System

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)

## Overview
The Triage System is an AI-powered, asynchronous customer support backend designed to automatically classify incoming support tickets. It intelligently routes raw ticket text through a vector similarity cache (via Supabase pgvector) to quickly bypass redundant LLM calls, falling back to a Hugging Face LLM (DeepSeek) to categorize, prioritize, gauge sentiment, and draft responses for novel issues.

## Features
* **Automated Ticket Classification:** Analyzes raw customer input to determine category, priority, and sentiment.
* **Semantic Caching:** Uses embeddings (BAAI/bge-base-en-v1.5) and vector search to match new tickets against a database of previously solved issues, minimizing LLM usage and latency.
* **Asynchronous Processing:** Leverages BullMQ and Redis to handle ticket processing in background worker queues, preventing API blocking.
* **Drafted Responses:** Automatically generates draft responses for support agents based on intelligent LLM inferences.
* **RESTful API:** Clean API endpoints built with Express, documented natively via Swagger UI.

## Tech Stack
* **Backend Framework:** Node.js, Express.js
* **Message Broker / Queues:** Redis, BullMQ
* **Database & Vector Search:** PostgreSQL (Supabase) with `pgvector`
* **AI/ML Models:** Hugging Face Inference API (DeepSeek-V4-Flash for reasoning, BAAI/bge-base-en-v1.5 for embeddings)
* **API Documentation:** Swagger UI (`yamljs`, `swagger-ui-express`)

## Architecture & Folder Structure

```text
TriageSystem/
 ├── backend/
 │    ├── controller/
 │    ├── routes/
 │    ├── utils/
 │    │    ├── agent/
 │    │    ├── bullmq/
 │    │    ├── redis/
 │    │    ├── supabase/
 │    │    └── test/
 │    ├── .env
 │    ├── main.js
 │    ├── package.json
 │    └── swagger.yaml
 └── .gitignore
```
**Architecture Pattern:** 
The application follows a decoupled backend architecture utilizing the **Controller-Route** pattern for the REST API, combined with an **Agentic Background Worker** pattern. The main API ingests data synchronously and places it onto a Redis queue. A separate BullMQ worker picks up the job asynchronously, performs vector similarity search in Supabase, and queries the Hugging Face Inference API if a cache miss occurs, ensuring scalable and non-blocking operations.

## File Directory Breakdown

| Directory / File | Description |
|---|---|
| `/backend/main.js` | The main entry point for the Express server. Initializes middleware, loads Swagger docs, and starts the database connections. |
| `/backend/routes/dataRoutes.js` | Defines the REST API endpoints (e.g., POST `/api/data`) for incoming ticket ingestion. |
| `/backend/controller/dataController.js` | Handles the business logic for the API routes. Inserts new ticket data into Supabase and enqueues background jobs via BullMQ. |
| `/backend/utils/agent/agent.js` | Manages LLM interactions via Hugging Face. Handles text embeddings (BAAI) and ticket classification parsing (DeepSeek). |
| `/backend/utils/bullmq/worker.js` | Defines the BullMQ worker that processes background jobs. Updates the DB with processing status, cache hits/misses, and handles errors. |
| `/backend/utils/bullmq/taskProcessor.js` | Core business logic for the worker. Executes the semantic cache check (vector search) and triggers the LLM fallback if no similar ticket exists. |
| `/backend/utils/bullmq/queue.js` | Initializes and exports the BullMQ queue for routing incoming tickets. |
| `/backend/utils/supabase/connectSupabase.js` | Establishes the PostgreSQL database connection pool for Supabase. |
| `/backend/utils/redis/connectRedis.js` | Establishes the connection to the Redis instance. |
| `/backend/swagger.yaml` | OpenAPI specification file for documenting the REST API endpoints. |
| `/backend/package.json` | Defines project dependencies, scripts, and metadata. |

## Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* Redis Server (running locally or remotely)
* Supabase Account (with a PostgreSQL database and `pgvector` enabled)
* Hugging Face API Token

### Installation & Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd TriageSystem/backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure Environment Variables**
Create a `.env` file in the `backend` directory (if not present) and add the following keys:
```env
PORT=5000
REDIS_URL=redis://localhost:6379
HF_TOKEN=your_huggingface_api_token
# Supabase Postgres connection string
DATABASE_URL=postgres://user:password@host:port/dbname
```

4. **Database Setup**
Ensure your Supabase database has the `pgvector` extension enabled and the required tables (`tickets`, `ticket_embeddings`) and functions (e.g., `match_tickets`) are created.

5. **Run the Server and Worker**
Start the application (this will initialize both the Express API and the BullMQ worker):
```bash
node main.js
```

6. **Access API Documentation**
Navigate to `http://localhost:5000/api-docs` in your browser to view and interact with the API endpoints via Swagger UI.
