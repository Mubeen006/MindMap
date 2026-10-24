# 🧠 Reel Knowledge Backend

> Production-ready AI pipeline that converts Instagram Reels and web resources into an indexed, searchable knowledge base with automated transcription, AI summaries, vector embeddings, and real-time chat notifications.

[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.x-FF4438?logo=redis&logoColor=white)](https://bullmq.io/)
[![Groq](https://img.shields.io/badge/Groq-Llama%203%20%7C%20Whisper-F55036)](https://groq.com/)
[![Ollama](https://img.shields.io/badge/Ollama-nomic--embed--text-000000?logo=ollama&logoColor=white)](https://ollama.ai/)

---

## 🚀 Overview

**Reel Knowledge Backend** serves as the intelligence engine of the Reel Knowledge (mindmap) ecosystem. It allows users to DM an Instagram Reel or article URL directly to an Instagram bot (or Telegram bot). The backend automatically intercepts the message, downloads the media, converts the audio, extracts high-fidelity transcripts, creates structured AI summaries and taxonomies, indexes the content with 768-dimensional vector embeddings, and messages the user back with instant insights.

### Ingestion & Processing Pipeline

```
[ Instagram DM / Webhook ] ──┐
                             ├─► [ BullMQ Queue ] ──► [ yt-dlp Video Download ]
[ Telegram Bot Message  ] ──┘                                 │
                                                              ▼
[ Completion Notification ] ◄── [ pgvector Index ] ◄── [ ffmpeg Audio Extraction ]
  (Instagram DM / Telegram)            ▲                      │
                                       │                      ▼
                           [ nomic-embed-text ]    [ Groq Whisper STT ]
                                       ▲                      │
                                       │                      ▼
                           [ Category Taxonomy ] ◄── [ Groq LLM Enrichment ]
```

---

## ⚡ Core Features

- **Multi-Channel Capture**:
  - **Instagram Graph API**: Webhook verification, secure HMAC-SHA256 signature verification, and automated weekly token rotation.
  - **Telegram Bot**: Full-featured bot fallback powered by Telegraf.
- **Asynchronous Processing**: Background job queue built with BullMQ and Redis for rock-solid concurrency and failure resilience.
- **Audio Extraction & Speech-to-Text**: Media retrieval via `yt-dlp` and `ffmpeg` with rapid transcript extraction via Groq Whisper.
- **AI Enrichment & Structured Taxonomy**: Categorizes reels into defined domains (AI, Coding, Design, Productivity, etc.), extracts actionable takeaways, and generates category overviews.
- **Vector Search Engine**: Generates 768-dimensional embeddings using Ollama's `nomic-embed-text` and executes sub-second cosine distance searches via PostgreSQL `pgvector`.
- **Media Streaming**: Range-request-enabled streaming endpoint (`/api/items/:id/video`) for smooth frontend in-browser video playback.

---

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (Express, TypeScript, Dependency Injection)
- **Database**: PostgreSQL 16 with [pgvector](https://github.com/pgvector/pgvector) extension
- **ORM**: [Prisma ORM](https://www.prisma.io/)
- **Job Queue**: [BullMQ](https://bullmq.io/) with [Redis](https://redis.io/)
- **LLM & Transcription**: [Groq Cloud API](https://groq.com/) (`whisper-large-v3`, `openai/gpt-oss-20b`, `llama-3.1-8b-instant`)
- **Embeddings**: [Ollama](https://ollama.com/) (`nomic-embed-text`)
- **Media Extraction**: `yt-dlp` and `ffmpeg`
- **Messaging SDKs**: Instagram Graph API v24.0, Telegraf

---

## 📋 Prerequisites

Before running the backend, make sure you have installed:

1. **Node.js** (v20+ recommended) and **npm** or **pnpm**
2. **Docker Desktop** (for running PostgreSQL, Redis, and Ollama)
3. **yt-dlp** and **ffmpeg** (accessible in your PATH or configured in `.env`)
   - Windows: `winget install Gyan.FFmpeg yt-dlp.yt-dlp`
   - macOS: `brew install ffmpeg yt-dlp`
   - Linux: `sudo apt install ffmpeg && pip install yt-dlp`
4. **Ollama model**: Make sure `nomic-embed-text` is pulled:
   ```bash
   ollama pull nomic-embed-text
   ```

---

## ⚙️ Installation & Setup

### 1. Clone & Install Dependencies

```bash
cd reel-knowledge-backend
npm install
```

### 2. Configure Environment Variables

Create your `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Database & Queue
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reelkb"
REDIS_HOST=localhost
REDIS_PORT=6379

# AI & Embeddings
OLLAMA_URL=http://localhost:11434
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
SEARCH_MAX_DISTANCE=0.65

# Media Binaries (use 'yt-dlp' and 'ffmpeg' if installed globally)
YT_DLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg

# Server Port
PORT=3000

# Instagram / Meta Graph API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_WEBHOOK_VERIFY_TOKEN=your_verify_token
IG_BOT_ACCOUNT_ID=your_bot_account_id
IG_BOT_ACCESS_TOKEN=your_bot_token
IG_PERSONAL_ACCOUNT_ID=your_personal_account_id
IG_PERSONAL_ACCESS_TOKEN=your_personal_token
ALLOWED_IG_SENDER_IDS=your_personal_igsid
IG_NOTIFY_IGSID=your_personal_igsid

# Telegram Bot (Optional fallback)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### 3. Start Infrastructure Containers

Start PostgreSQL (with pgvector), Redis, and Ollama using Docker Compose:

```bash
docker compose up -d
```

### 4. Run Migrations & Seed Data

```bash
# Apply database schema
npx prisma migrate deploy

# Seed initial category taxonomy
npm run seed:categories

# Seed Instagram tokens into the settings database
npm run seed:ig-tokens
```

### 5. Start the Development Server

```bash
npm run start:dev
```

The server will be running at **`http://localhost:3000/api`**.

---

## 📡 API Reference

All routes are prefixed with `/api`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/items` | List processed items (supports `?categoryId=<id>`) |
| `GET` | `/items/:id` | Fetch single item details, transcript, and takeaways |
| `GET` | `/items/:id/video` | Stream video file with HTTP 206 range-request support |
| `GET` | `/items/unlinked` | List web resource items not yet linked to reels |
| `GET` | `/items/incomplete` | List items whose processing encountered errors |
| `POST` | `/items/:id/retry` | Re-queue a failed item for processing |
| `POST` | `/items/:id/resources` | Attach a web resource link to a reel |
| `PATCH` | `/items/:id/link` | Link an existing resource to a reel |
| `PATCH` | `/items/:id` | Update metadata, category, or notes |
| `DELETE` | `/items/:id` | Delete an item from database and storage |
| `GET` | `/categories` | Fetch all categories with item counts and overviews |
| `GET` | `/search?q=query` | Hybrid semantic vector search & text matching |
| `GET` | `/instagram/webhook` | Meta webhook verification endpoint |
| `POST` | `/instagram/webhook` | Meta webhook event receiver (HMAC signature validated) |

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start NestJS in watch mode with pre-infra health checks |
| `npm run build` | Build production bundle in `dist/` |
| `npm run start:prod` | Run compiled production server |
| `npm run docker:up` | Start Postgres, Redis, and Ollama containers |
| `npm run docker:down` | Stop Docker containers |
| `npm run seed:categories` | Seed predefined taxonomy categories into database |
| `npm run seed:ig-tokens` | Upsert Instagram access tokens from `.env` to DB settings |
| `npm run backfill:embeddings` | Recompute vector embeddings for all existing items |
| `npm run generate:overviews` | Generate AI category synthesis overviews using Groq |
| `npm run reprocess` | Force re-extraction and enrichment for all items |
| `npm run check:infra` | Check PostgreSQL and Redis connectivity |

---

## 🔒 Security & Privacy

- **Never commit `.env` or secret keys.** Keep all API tokens and database credentials inside `.env`, which is untracked in `.gitignore`.
- **HMAC-SHA256 Verification**: Instagram webhook requests are verified using Meta's `X-Hub-Signature-256` header before any payload processing.
- **Access Control**: Webhook capture enforces `ALLOWED_IG_SENDER_IDS` so only authorized accounts can ingest items into the database.

---

## 📄 License

This project is private and proprietary.
