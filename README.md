# SA AI Assistant

Monorepo for the SA AI Assistant, with a Hono API and a TanStack React platform.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker with Docker Compose

## Setup

```sh
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
pnpm --filter api db:generate
pnpm --filter api db:deploy
```

The root `.env` is local-only and must not be committed.

Before using document uploads, configure the R2 values in `.env`. The
`R2_PUBLIC_BASE_URL` must point to a publicly readable R2 bucket URL because it
is stored with the document and will be used later by the OCR worker.

## Development

Run the API and platform from the repo root (a `predev` hook frees ports 8000/3000
from stale processes before starting):

```sh
pnpm dev
```

Or run each app in separate terminals:

```sh
pnpm --filter api dev
pnpm --filter platform dev
```

The document worker is a separate process. It is not required while testing R2
uploads, but run it when OCR and vector processing are enabled:

```sh
pnpm --filter api worker
```

- API: http://localhost:8000
- Platform: http://localhost:3000
- PostgreSQL: localhost:55432
- Redis: localhost:16379
- Qdrant HTTP API: http://127.0.0.1:6333
- Qdrant gRPC API: 127.0.0.1:6334

## Document Uploads

The platform provides a session-scoped document list in the conversation
sidebar. Supported uploads include PDF, Markdown, DOCX, and common flowchart
image formats.

The API stores uploaded files in Cloudflare R2 and stores their metadata in
PostgreSQL. Documents are associated with the active conversation through the
`x-conversation-id` header.

Available API endpoints:

```text
POST   /documents       Upload a multipart file for the active session
GET    /documents       List documents for the active session
DELETE /documents/:id   Delete a document and its R2 object
```

Uploads are stored in R2 and enqueued to the `doc-ingestion` BullMQ queue.
The worker performs Markdown/DOCX extraction or OCR, stores pages and summary,
embeds page content, and indexes it in Qdrant with user/session isolation.
Template documents are subsequently sent to `template-extract`; flowchart
images are sent to `flowchart-verify`.

Required R2 configuration:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

## Useful commands

```sh
pnpm --filter api db:studio
pnpm --filter api db:deploy
pnpm --filter api worker
pnpm --filter api build
pnpm --filter platform build
pnpm lint
pnpm format:check
```

## Repository layout

- `docker-compose.dev.yml` — local PostgreSQL, Redis, and Qdrant services
- `.env.example` — safe environment template
- `apps/api/src/modules/document` — R2 upload API and document metadata handling
- `apps/api/src/worker` — OCR, summary, embedding, and Qdrant processing worker
- `apps/platform/src/hooks/use-documents.ts` — session document upload/status state
