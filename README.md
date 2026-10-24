# 🧠 MindMap — Reel Knowledge Base

<p align="center">
  <strong>Transform spoken knowledge trapped in Instagram Reels & web articles into an intelligent, searchable personal mindmap.</strong>
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16.x-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" /></a>
  <a href="https://nestjs.com"><img src="https://img.shields.io/badge/NestJS-11.x-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" /></a>
  <a href="https://github.com/pgvector/pgvector"><img src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://bullmq.io"><img src="https://img.shields.io/badge/BullMQ-5.x%20%2B%20Redis-FF4438?style=for-the-badge&logo=redis&logoColor=white" alt="BullMQ" /></a>
  <a href="https://groq.com"><img src="https://img.shields.io/badge/Groq-Whisper%20%7C%20Llama%203-F55036?style=for-the-badge" alt="Groq" /></a>
  <a href="https://ollama.ai"><img src="https://img.shields.io/badge/Ollama-nomic--embed--text-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
</p>

---

## 🌟 Overview

**MindMap** (Reel Knowledge) is a production-grade full-stack AI platform designed to capture, organize, and synthesize knowledge from short-form videos and articles. 

Instead of letting saved Instagram Reels get buried forever in your bookmarks, simply DM any Reel or web URL to your dedicated Instagram Bot (or Telegram Bot). MindMap automatically extracts the audio, transcribes the speech, generates structured takeaways and taxonomies, indexes the content with 768-dimensional dense vector embeddings, and notifies you in real-time with instant insights—all accessible through a sleek Next.js dashboard.

---

## 🔄 End-to-End Processing Architecture

```
                                  MULTI-CHANNEL CAPTURE
                      ┌──────────────────────────────────────────────┐
                      │  Instagram DM (Meta Graph API v24.0 Webhook) │
                      │  Telegram Bot (Telegraf Fallback Channel)    │
                      └──────────────────────┬───────────────────────┘
                                             │  (Raw HMAC-SHA256 verified)
                                             ▼
                                  ASYNC INGESTION QUEUE
                      ┌──────────────────────────────────────────────┐
                      │    BullMQ + Redis Background Job Engine      │
                      └──────────────────────┬───────────────────────┘
                                             │
                         ┌───────────────────┴───────────────────┐
                         ▼                                       ▼
                  [ MEDIA PIPELINE ]                    [ RESOURCE PIPELINE ]
             yt-dlp Video Retrieval                      Cheerio HTML Scraper
                        │                                        │
             ffmpeg Audio Conversion                             │
                        │                                        │
                        ▼                                        ▼
             Groq Whisper-large-v3 STT                Extract Content & Metadata
                        │                                        │
                        └───────────────────┬────────────────────┘
                                            ▼
                               [ AI ENRICHMENT & TAXONOMY ]
                                 Groq Cloud LLM Inference
                           • Structured Key Takeaways & Summaries
                           • Domain Taxonomy & Topic Tagging
                                            │
                                            ▼
                               [ VECTOR EMBEDDINGS ENGINE ]
                             Ollama `nomic-embed-text`
                           • 768-dimensional dense vectors
                                            │
                                            ▼
                                 [ PERSISTENCE LAYER ]
                                PostgreSQL 16 + pgvector
                           • Cosine distance similarity index
                           • Range-request video storage
                                            │
                        ┌───────────────────┴───────────────────┐
                        ▼                                       ▼
             [ INSTANT NOTIFICATIONS ]              [ NEXT.JS 16 WEB APP ]
              • Instagram DM Reply                   • Semantic Vector Search
              • Telegram Message                     • In-Browser Video Player
                                                     • Synchronized Transcripts
                                                     • Taxonomy Category Strips
```

---

## ✨ Key Capabilities

| Capability | Description |
|---|---|
| **Multi-Channel Ingestion** | Capture content seamlessly via **Instagram DMs** (Meta Graph API v24.0) or **Telegram Bot** without leaving your mobile apps. |
| **High-Fidelity Audio STT** | Fast, high-accuracy speech-to-text conversion via **Groq Whisper-large-v3**, generating full timestamped dialogue transcripts. |
| **AI Enrichment & Taxonomies** | Strict JSON schema extraction powering bulleted executive summaries, core takeaways, topic tags, and domain classification. |
| **Semantic & Hybrid Search** | Natural language queries via **PostgreSQL pgvector** (cosine distance threshold `<0.65`) finds reels conceptually, even without keyword matches. |
| **In-Browser Video Streaming** | HTTP 206 partial-content range streaming directly inside the Next.js frontend modal. |
| **Production Webhook Security** | Raw-body **HMAC-SHA256 signature validation** protecting against unauthorized webhook payloads, paired with weekly automated token refresh cron jobs. |

---

## 📁 Repository Structure

This repository is organized as a unified full-stack monorepo:

```
MindMap/
├── reel-knowledge-backend/     # NestJS 11 REST API, BullMQ worker, AI pipeline
│   ├── prisma/                 # PostgreSQL schema & pgvector migrations
│   ├── scripts/                # Database seeds, embedding backfills & diagnostics
│   ├── src/                    # Controllers, modules, services & processors
│   ├── docker-compose.yml      # Postgres (pgvector), Redis & Ollama services
│   ├── .env.example            # Backend environment template
│   └── README.md               # In-depth backend architecture guide
│
├── reel-knowledge-frontend/    # Next.js 16 (App Router), React 19, Tailwind CSS v4
│   ├── app/                    # Pages: dashboard, categories, items, search
│   ├── components/             # Video player, search bar, transcript accordion
│   ├── lib/                    # API client, taxonomy helpers, TypeScript types
│   ├── .env.example            # Frontend environment template
│   └── README.md               # Frontend development & deployment guide
│
├── .gitignore                  # Monorepo-level ignore rules (secrets protected)
└── README.md                   # Repository landing guide (this file)
```

---

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server & Client Components)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: Custom SVG Node-Cluster Branding & Lucide Icons
- **Language**: TypeScript 5

### Backend
- **Framework**: [NestJS 11](https://nestjs.com/) (Express, Dependency Injection)
- **Database ORM**: [Prisma ORM 6](https://www.prisma.io/)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/) with [pgvector](https://github.com/pgvector/pgvector) extension
- **Job Queue**: [BullMQ 5](https://bullmq.io/) with [Redis 7](https://redis.io/)
- **Media Engine**: `yt-dlp` and `ffmpeg` (fluent-ffmpeg)

### AI & Speech Models
- **Speech-to-Text**: [Groq Cloud](https://groq.com/) `whisper-large-v3`
- **LLM Reasoning & Summaries**: `openai/gpt-oss-20b`, `llama-3.1-8b-instant`, or `qwen/qwen3.6-27b`
- **Dense Embeddings**: [Ollama](https://ollama.com/) `nomic-embed-text` (768 dimensions)

---

## 🚀 Quick Start Guide

Follow these steps to get the entire full-stack system running locally:

### 1. Prerequisites
- **Node.js** v20+ and **npm**
- **Docker Desktop** (for running PostgreSQL, Redis, and Ollama)
- **yt-dlp** and **ffmpeg** installed on your system PATH:
  - **Windows**: `winget install Gyan.FFmpeg yt-dlp.yt-dlp`
  - **macOS**: `brew install ffmpeg yt-dlp`
  - **Linux**: `sudo apt install ffmpeg && pip install yt-dlp`
- **Ollama**: Pull the embedding model:
  ```bash
  ollama pull nomic-embed-text
  ```

---

### 2. Configure & Start the Backend

```bash
cd reel-knowledge-backend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# (Edit .env and provide your GROQ_API_KEY, Instagram tokens, etc.)

# 3. Spin up PostgreSQL (with pgvector), Redis, and Ollama
docker compose up -d

# 4. Run database migrations and seed taxonomy categories
npx prisma migrate deploy
npm run seed:categories
npm run seed:ig-tokens

# 5. Start the backend API server (runs on port 3000)
npm run start:dev
```

The backend REST API will be available at: **`http://localhost:3000/api`**.

---

### 3. Configure & Start the Frontend

In a separate terminal window:

```bash
cd reel-knowledge-frontend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local

# 3. Start development server (runs on port 3001)
npm run dev
```

Open your browser to: **`http://localhost:3001`**.

---

## 📡 REST API Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/items` | List all ingested items (supports `?categoryId=<id>`) |
| `GET` | `/api/items/:id` | Get item details, transcript, and AI takeaways |
| `GET` | `/api/items/:id/video` | Stream video file with HTTP 206 range-request support |
| `GET` | `/api/categories` | Fetch taxonomy categories with count & summaries |
| `GET` | `/api/search?q=...` | Natural language semantic & vector search |
| `POST` | `/api/items/:id/retry` | Re-queue a failed item for processing |
| `POST` | `/api/items/:id/resources` | Attach external resource or documentation link |
| `GET` | `/api/instagram/webhook` | Meta Webhook challenge verification endpoint |
| `POST` | `/api/instagram/webhook` | Meta Webhook receiver with HMAC-SHA256 verification |

---

## 🔒 Security & Safe Secrets Handling

- All `.env` and `.env.local` files containing real API keys and credentials are **strictly ignored** in `.gitignore`.
- Sanity-checked `.env.example` templates are provided in both sub-projects.
- Webhook endpoints enforce strict cryptographic signature verification to safeguard against spoofed requests.

---

## 📄 License

This repository is private and proprietary.
