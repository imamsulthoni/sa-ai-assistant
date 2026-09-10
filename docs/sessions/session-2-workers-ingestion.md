# S2 — Worker Multi-Queue & Ingestion Pipeline

**PRD refs:** §5.3 (worker queues), §5.2 (schema), §10 Day 2.
**Gate pass → proceed S3.** Commit `feat(api): multi-queue workers + ingestion pipeline`.

---

## 1. Context (current repo state)

- `apps/api/src/lib/queue.ts` — **single** queue `document-processing`, `redisConnection` {host, port}. `DOCUMENT_QUEUE_NAME` env.
- `apps/api/src/worker/index.ts` — **single** `Worker` process, concurrency 2.
- `apps/api/src/worker/process-document.ts` — OCR (`@anvia/mistral`), summary (`@anvia/core` + OpenAI), `DocumentPage` writes, embedding (`@anvia/transformers`), Qdrant upsert (payload: `documentId, documentName, pageNumber, metadata`). **Missing:** DOCX extraction, `userId`/`sessionId` in embedding payload, template/flowchart queues.
- `apps/api/src/modules/document/router.ts` — R2 upload + metadata create; **enqueue is commented out**.
- `apps/api/src/modules/document/services.ts` — R2 client + `documentUrl`.
- `docker-compose.dev.yml` — postgres:16, redis:7, qdrant:v1.18.3 (ports 55432/16379/6333).
- `apps/api/prisma/schema.prisma` — `Document` (has `userId`, `objectKey`, `summary`, `error`, `DocumentPage`), enum `DocumentStatus` (UPLOADING/PROCESSING/READY/FAILED — **no PENDING_CONFIRMATION yet**), `DocumentFileType` (PDF/MARKDOWN/IMAGE_FLOWCHART/DOCX/OTHER).

## 2. Goal

3 independent BullMQ queues + workers, complete ingestion pipeline (DOCX extraction, embedding isolation payload), R2 upload wired + enqueue enabled.

## 3. Implementation requirements

### 3.1 Queue layer (`apps/api/src/lib/queue.ts`)
- Refactor to 3 named queues: `doc-ingestion`, `template-extract`, `flowchart-verify` (keep `DOCUMENT_QUEUE` env as legacy fallback for migration).
- Shared `redisConnection`. Job payloads **ringan** (never binary): `doc-ingestion: {documentId, objectKey}`, `template-extract: {documentId, objectKey}`, `flowchart-verify: {documentId, objectKey, brdDocumentId}`.
- Config per queue (§5.3): `doc-ingestion` concurrency 2 / attempts 3 / backoff exp; `template-extract` concurrency 4 / attempts 1; `flowchart-verify` concurrency 4 / attempts 2 / **priority tinggi**.

### 3.2 Workers (`apps/api/src/worker/`)
- Split handlers: `process-document.ts` (ingestion), `extract-template.ts` (NEW), `verify-flowchart.ts` (NEW).
- `apps/api/src/worker/index.ts` → 3 `Worker` processes (separate file: `worker-doc.ts`, `worker-template.ts`, `worker-flowchart.ts` + orchestrator `index.ts`), each with own concurrency/retry.
- Status lifecycle: set `PROCESSING` at start → `READY`/`FAILED` (+`error`) at end. Template job ends at `PENDING_CONFIRMATION`.

### 3.3 `process-document.ts` upgrades
- **DOCX extraction:** if `fileType === "DOCX"`, extract text via mammoth (or pandoc) BEFORE OCR. Mistral OCR tidak parse .docx.
- **MARKDOWN:** skip OCR, `READY` direct (existing).
- **Embedding payload isolation (§5.3):** add `userId`, `sessionId` to Qdrant payload. **Non-negotiable** — S3/S5 depends on retrieval filter.
- Keep summary + `DocumentPage` writes. Store `ocrResult` + `summary`.

### 3.4 `extract-template.ts` (NEW)
- Read `DocumentPage` rows (from `doc-ingestion` output) → `createCompletion` via `@anvia/core` → parse structure (heading hierarchy, mandatory sections, ID conventions `BR-XXX`/`REQ-XXX`, metadata) → save `templateStructure` → status `PENDING_CONFIRMATION`.
- **Never auto-apply** — SA approval is S3/S4 (`/settings/template`).

### 3.5 `verify-flowchart.ts` (NEW)
- Load image from R2 → OCR via `@anvia/mistral` vision → extract nodes/arrows/teks → cross-match vs active BRD (resolve `brdDocumentId` → `BrdDocument.contentMarkdown`, may be null) → save `report` (`matches/gaps/recommendations`). No silent repair.

### 3.6 Enqueue wiring (`apps/api/src/modules/document/router.ts`)
- Uncomment/enable enqueue with routing by file type/operation:
  - Image → `flowchart-verify` (+ `brdDocumentId` from request metadata if provided)
  - `isTemplate` → `doc-ingestion` then chain `template-extract` (or enqueue both; template-extract job reads `DocumentPage`)
  - else → `doc-ingestion`
- Add `GET /documents/:id` returning document + `templateStructure`/`report`/`status`/`error` for frontend polling.
- On enqueue failure → mark `FAILED` + `error`.

### 3.7 R2 upload (existing in `services.ts`)
- Verify `uploadDocument`/`deleteDocument`/`documentUrl` correct; ensure `R2_PUBLIC_BASE_URL` documented (OCR worker needs it).

## 4. Verify steps

```sh
docker compose -f docker-compose.dev.yml up -d        # infra up
pnpm --filter api db:generate
pnpm --filter api db:migrate                          # schema with PENDING_CONFIRMATION if added
pnpm --filter api worker                              # terminal 1
pnpm --filter api dev                                 # terminal 2
pnpm lint && pnpm format:check && pnpm --filter api build
```

Manual E2E (upload via curl):
```sh
curl -X POST http://localhost:8000/documents \
  -H "x-user-id: demo-user" -H "x-conversation-id: sess-1" \
  -F "file=@/path/to/sample.pdf"
curl http://localhost:8000/documents/<id>             # poll until READY
```
- Confirm: `DocumentPage` rows exist, `summary`/`ocrResult` filled, Qdrant collection `documents` has vectors **with `userId`+`sessionId` payload**, status `READY`.
- Upload `.docx` → confirm text extracted (no OCR error).
- Upload image flowchart with `brdDocumentId` → confirm `flowchart-verify` priority job runs and `report` saved.

## 5. Acceptance criteria

- [x] 3 named queues with correct concurrency/retry/priority.
- [x] 3 independent worker processes.
- [x] DOCX extracted via mammoth/pandoc, not OCR.
- [x] Embedding payload includes `userId` + `sessionId`.
- [x] Enqueue enabled + routing by file type; enqueue failure → `FAILED`+`error`.
- [x] `template-extract` → `templateStructure` + `PENDING_CONFIRMATION` (never auto-apply).
- [x] `flowchart-verify` → `report` saved, no silent repair.
- [x] `GET /documents/:id` polling endpoint returns status/structure/report.
- [x] Docker compose infra up; migrations clean.
- [x] `pnpm lint` and `pnpm --filter api build` clean.
- [x] Targeted formatting checks for Session 2 API files clean.
- [x] Repository-wide `pnpm format:check` clean.
- [x] Git commit checkpoint.

## 6. What to return to user

- Files touched/changed.
- E2E proof: curl output + DB/Qdrant inspection.
- Adapter interfaces ready for S3 (`search_context` grounding can now hit real Qdrant).
