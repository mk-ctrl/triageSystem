# Triage System

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)

## Overview
The Triage System is an AI-powered, asynchronous customer support backend and real-time dashboard designed to automatically ingest, classify, and resolve incoming support tickets. 

It routes raw ticket text through a vector similarity cache (via Supabase pgvector) to bypass redundant LLM calls. On a cache miss, it falls back to a Hugging Face LLM (DeepSeek) to categorize, prioritize, gauge sentiment, and draft responses for novel issues. The system features a modern, real-time React agent dashboard connected via Socket.io.

---

## Features
* **Automated Ticket Classification:** Analyzes customer queries to determine category, priority, and sentiment.
* **Semantic Caching:** Uses embeddings (`BAAI/bge-base-en-v1.5`) and vector search to match new tickets against previous solved issues, minimizing LLM usage and latency.
* **Asynchronous Processing:** Leverages BullMQ and Redis to handle heavy LLM processing in background worker queues, keeping the ingestion API non-blocking.
* **Real-time Live Sync (WebSockets):** Utilizes Socket.io and BullMQ `QueueEvents` to broadcast ticket updates instantly to the agent dashboard as they move from `pending` ➔ `processing` ➔ `completed`.
* **Interactive Agent Workspace:** Sleek React dashboard featuring an optimistic list view, connection indicator, and live response drafting panel.
* **Human-in-the-Loop Override:** Provides an interface for agents to manually edit draft replies or override classification categories before saving back to Supabase.
* **CRUD Management & Analytics:** REST API endpoints to retrieve paginated lists of tickets, fetch stats, update classifications, and query cache-hit ratios.

---

## Tech Stack
* **Frontend:** React, Vite, Socket.io-client, Vanilla CSS (Premium Slate theme)
* **Backend:** Node.js, Express.js, Socket.io, HTTP Server
* **Message Broker & Queues:** Redis, BullMQ (Workers & QueueEvents)
* **Database & Vector Search:** PostgreSQL (Supabase) with `pgvector`
* **AI/ML Models:** Hugging Face Inference API (`DeepSeek-V4-Flash` for reasoning, `BAAI/bge-base-en-v1.5` for embeddings)
* **API Documentation:** Swagger UI (`yamljs`, `swagger-ui-express`)

---

## System Architecture Flow

```mermaid
sequenceDiagram
    autonumber
    participant Client as React Dashboard (Vite)
    participant Server as Express & Socket.io
    participant Queue as Redis Queue (BullMQ)
    participant Worker as Background Worker
    participant DB as PostgreSQL (Supabase)

    Client->>Server: HTTP POST /api/data (New Ticket)
    Server->>DB: Write ticket (status: 'pending')
    Server->>Queue: Enqueue classification job
    Server-->>Client: HTTP 201 Created (ticket ID)
    Server->>Client: Socket.io Emit: 'ticket_new' (Live Card Added)
    
    Queue->>Worker: Dequeue job
    Worker->>DB: Perform pgvector cache search
    alt Cache Miss
      Worker->>Worker: Call embedding (BAAI)
      Worker->>Worker: Call LLM (DeepSeek)
      Worker->>DB: Save new embedding & classification
    else Cache Hit
      Worker->>DB: Retrieve cached classification
    end
    Worker->>DB: Update ticket (status: 'completed', classification, draft)
    Worker-->>Queue: Job completed event

    Server->>Queue: QueueEvents: 'completed'
    Server->>DB: Query completed ticket record
    Server->>Client: Socket.io Emit: 'ticket_resolved' (Live UI Update)
```

---

## Folder Structure

```text
TriageSystem/
 ├── backend/
 │    ├── controller/           # Ingestion and ticket management logic
 │    ├── routes/               # API endpoints (/api/data, /api/tickets, /api/analytics)
 │    ├── utils/
 │    │    ├── agent/           # HF LLM classification and embedding generation
 │    │    ├── bullmq/          # BullMQ queue config, background worker, and QueueEvents listener
 │    │    ├── redis/           # Redis connection configuration
 │    │    ├── socket/          # Socket.io server instance helper
 │    │    ├── supabase/        # Database pool setup
 │    │    └── test/            # HTTP endpoint integration test script
 │    ├── .env
 │    ├── main.js               # App entrypoint (initializes Express, WebSockets, & QueueEvents)
 │    ├── package.json
 │    └── swagger.yaml          # OpenAPI schema spec
 ├── frontend/
 │    ├── public/
 │    ├── src/
 │    │    ├── assets/
 │    │    ├── hooks/
 │    │    │    └── useTicketSocket.js  # Real-time state syncing hook
 │    │    ├── App.jsx          # Agent dashboard application
 │    │    ├── index.css        # Premium dashboard styles
 │    │    └── main.jsx
 │    ├── index.html
 │    ├── package.json
 │    └── vite.config.js        # Vite build config with server proxy setups
 └── .gitignore
```

---

## REST API Endpoints

All management endpoints are documented natively and can be tested at `http://localhost:5000/api-docs`.

| Method | Endpoint | Description |
|---|---|---|
| **POST** | `/api/data` | Public ticket ingestion endpoint. Adds ticket to Supabase and enqueues job. |
| **GET** | `/api/tickets` | Lists tickets with filtering (`status`, `customer_mail`, `category`, `priority`, `sentiment`) & pagination (`limit`, `page`). |
| **GET** | `/api/tickets/:id` | Retrieves status and details of a single ticket by UUID. |
| **PATCH** | `/api/tickets/:id` | Updates ticket details, overrides classification values, or edits draft response. |
| **DELETE** | `/api/tickets/:id` | Safe transactional delete of a ticket and its vector embeddings. |
| **GET** | `/api/analytics` | Fetches ticket distributions (priority, category, sentiment, status) and cache-hit ratios. |
| **GET** | `/health` | Ingestion service check. |

---

## Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* Redis Server (running locally or cloud instance)
* Supabase Account (with PostgreSQL and `pgvector` enabled)
* Hugging Face API Token

### Setup & Installation

#### 1. Configure the Backend
1. Navigate to the `backend` folder:
   ```bash
   cd TriageSystem/backend
   ```
2. Install package dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` directory and add the following keys:
   ```env
   PORT=5000
   REDIS_URL=redis://your-redis-url:port
   SUPABASE_URL=postgresql://postgres:password@your-supabase-host:5432/postgres
   HF_TOKEN=your_huggingface_api_token
   ```

#### 2. Configure the Frontend
1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```
2. Install package dependencies:
   ```bash
   npm install
   ```

---

### Running the System

To run the full triage pipeline, you need to spin up both servers:

1. **Start the Backend**:
   In the `/backend` directory, boot up the Express server, background workers, and WebSocket listeners:
   ```bash
   node main.js
   ```
2. **Start the Frontend**:
   In the `/frontend` directory, start the Vite developer client:
   ```bash
   npm run dev
   ```
3. **Usage**:
   * Open the dashboard at `http://localhost:5173` (or the port specified by Vite).
   * Submit new issues in the **Mock Ingestion Portal** on the right side of the dashboard to see them propagate, triage, and complete in real-time.
   * Access interactive Swagger API documentation at `http://localhost:5000/api-docs`.
