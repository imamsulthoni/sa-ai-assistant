# Dokumentasi Flow Fitur — SA AI Assistant

Dokumen ini menjelaskan seluruh alur fitur yang tersedia di project ini beserta maksud & tujuan tiap langkah, potongan kode kunci, dan lokasi file terkait.

- **Terakhir diperbarui**: 2026-09-13
- **Cakupan**: `apps/api` (backend + worker), `apps/platform` (frontend), `packages/agent` (prompt & tools agen)
- **Infrastruktur**: PostgreSQL (Prisma), Redis + BullMQ (queue), Qdrant (vector DB), Cloudflare R2 (object storage), Mistral OCR, OpenAI-compatible LLM, Tavily (web search)

---

## Daftar Isi

1. [Arsitektur Singkat](#1-arsitektur-singkat)
2. [Flow 1 — Generate BRD dari User Story](#2-flow-1--generate-brd-dari-user-story)
3. [Flow 2 — Import BRD Existing](#3-flow-2--import-brd-existing)
4. [Manajemen File Sesi & Peta Data (Sidebar, Paperclip, OCR, Qdrant, Hapus)](#4-manajemen-file-sesi)
5. [@Mention File dalam Sesi](#5-mention-file-dalam-sesi)
6. [QA, Modifikasi BRD, Approval, Versioning & Export](#6-qa-modifikasi-brd-approval-versioning--export)
7. [Template BRD (Upload → Ekstraksi → Approval)](#7-template-brd)
8. [Sesi & Memori Percakapan](#8-sesi--memori-percakapan)
9. [Settings](#9-settings)
10. [Ringkasan Endpoint API](#10-ringkasan-endpoint-api)
11. [Peta File Penting](#11-peta-file-penting)
12. [Catatan & Batasan Saat Ini](#12-catatan--batasan-saat-ini)

---

## 1. Arsitektur Singkat

```
┌────────────────────────┐        ┌──────────────────────────────────────┐
│  apps/platform (React) │  HTTP  │  apps/api (Hono)                     │
│  - Workspace/Chat UI   │ ─────▶ │  /chat /sessions /documents          │
│  - BRD Document Pane   │        │  /brd /settings /search              │
└────────────────────────┘        └───────────┬──────────────────────────┘
                                              │ enqueue job
                                              ▼
                                  ┌───────────────────────────┐
                                  │ Redis + BullMQ            │
                                  │ doc-ingestion             │
                                  │ template-extract          │
                                  └───────────┬───────────────┘
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │ apps/api/src/worker                          │
                       │ - process-document (OCR/ekstraksi/embedding) │
                       │ - extract-template (struktur template)       │
                       └───────┬───────────────┬──────────────────────┘┘
                               ▼               ▼
                        PostgreSQL         Qdrant (collection "documents")
                               ▲               ▲
                               └───── Prisma ──┘
```

Mounting seluruh route API:

```ts
// apps/api/src/index.ts
const app = new Hono()
  .use(cors({ /* ... */ }))
  .route("/chat", chatModule)
  .route("/sessions", sessionModule)
  .route("/documents", documentModule);

app.route("/brd", brdModule).route("/settings", settingsModule).route("/search", searchModule);
```

Identitas user diambil dari header `x-user-id` dengan fallback `demo-user`:

```ts
// apps/api/src/lib/identity.ts
export function resolveUserId(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : DEMO_USER_ID;
}
```

---

## 2. Flow 1 — Generate BRD dari User Story

> Tujuan: mengubah user story yang belum lengkap menjadi BRD lengkap dengan klarifikasi terbatas (maks 2 putaran) sebelum dokumen ditulis, sehingga tidak ada asumsi diam-diam.

### 2.1 Diagram state

```
EMPTY_SESSION ──(Generate BRD)──▶ CLARIFYING ──(jawab/skip)──▶ GENERATING ──▶ BRD_ACTIVE
                     ▲                │                           │
                     └────────────────┘ (round 2)                └─(gagal)─▶ CLARIFYING/EMPTY_SESSION
```

State diatur di `apps/platform/src/routes/workspace.tsx`:

```tsx
type Phase = "EMPTY_SESSION" | "CLARIFYING" | "GENERATING" | "BRD_ACTIVE";
```

Stepper UI (`User story → Clarification → Generate BRD`) mengikuti `phase`:

```tsx
const stepKey: StepKey =
  phase === "CLARIFYING" ? "clarify" : phase === "GENERATING" ? "generate" : "story";
```

### 2.2 Langkah 1 — Input user story / stakeholder brief

- **Maksud**: menangkap konteks bisnis awal + dokumen rujukan opsional.
- **UI**: `NewBrdPanel` mode `"story"` (`apps/platform/src/modules/brd/new-brd-panel.tsx`).
- **Handler**: `generate(story, file)` di `workspace.tsx`.

```tsx
// apps/platform/src/routes/workspace.tsx — generate()
const generate = useCallback(async (story: string, file?: File) => {
  if (!activeId) return;
  setFlowError(null);
  try {
    if (file) {
      await uploadDocument(activeId, file); // masuk pipeline dokumen (lihat §4)
      refreshDocuments();                    // sidebar kiri ikut ter-update
    }
    setUserStory(story);
    setRound(1);
    setRoundAnswers({});
    setPhase("GENERATING");
    const result = await clarifyBrd(activeId, { userStory: story, round: 1 });
    if (result.clarification_questions.length) {
      setQuestions(result.clarification_questions);
      setPhase("CLARIFYING");
    } else await runGeneration({}, true, story);
  } catch (caught) {
    setFlowError(`Unable to start BRD generation: ${messageOf(caught)}`);
    setPhase("EMPTY_SESSION");
  }
}, [activeId, runGeneration, refreshDocuments]);
```

### 2.3 Langkah 2 — Round 1 klarifikasi (fase `CLARIFY`)

- **Maksud**: agen hanya bertugas menemukan celah informasi berdampak tinggi; tidak menilai kelayakan akhir dan tidak menulis BRD.
- **Endpoint**: `POST /brd/clarify` (`apps/api/src/modules/brd/router.ts`).
- **Service**: `clarifyFlow()` (`apps/api/src/modules/brd/services.ts`).
- **Agen**: instruksi `CLARIFY_INSTRUCTIONS` (`packages/agent/src/prompt/clarify.ts`).
- **Tool**: `elicit_clarifications` (`packages/agent/src/tools/clarifications.ts`), maksimal 3 pertanyaan, id `q{round}_{n}`, `capped` bila round 2.

```ts
// apps/api/src/modules/brd/services.ts — clarifyFlow()
const agent = await agentFor(context.userId, context.sessionId, "CLARIFY");
const result = await collectAgent(agent, prompt, context);
const tool = result.toolResults.find((item) => item.toolName === "elicit_clarifications");
const parsed = safeParse(
  ClarificationOutputSchema,
  tool?.output?.value ?? parseLooseJson(result.text) ?? {},
);
```

Template aktif (jika ada) disuntikkan agar pertanyaan mengarah ke section wajib:

```ts
async function flowTemplateBlock(userId: string): Promise<string | null> {
  const active = await activeTemplateFor(userId);
  return active ? templateInstructionBlock(active.structure) : null;
}
```

- **UI**: `FeedbackForm` (`apps/platform/src/modules/brd/feedback-form.tsx`) menampilkan opsi pilihan ganda + jawaban bebas, dengan tombol **Generate with assumptions** (skip).

### 2.4 Langkah 3 — Submit jawaban: `JUDGE` lalu `GENERATE`

- **Endpoint**: `POST /brd/submit-clarification`.
- **Service**: `submitClarificationFlow()` (`apps/api/src/modules/brd/services.ts`).
- **Maksud `JUDGE`**: menilai apakah bukti sudah cukup untuk BRD yang dapat direview. Jika round 1 masih kurang → hasilkan pertanyaan lanjutan round 2 (maks 3, id `q2_n`, tidak mengulang yang sudah dijawab).
- **Round 2 bersifat final**: kekurangan dicatat sebagai asumsi/GAP, bukan pertanyaan lagi.

```ts
// apps/api/src/modules/brd/services.ts — submitClarificationFlow()
let sufficient = Boolean(input.skip) || round === 2;
if (!sufficient) {
  const judge = await agentFor(context.userId, context.sessionId, "JUDGE");
  const judgedOutput = safeParse(JudgeOutputSchema, parseLooseJson(judged.text) ?? {});
  sufficient = judgedOutput?.sufficient ?? false;
  if (!sufficient && round < 2) return { type: "clarification", round: 2, /* ... */ };
}
```

- **Maksud `GENERATE`**: menulis BRD final (bukan hanya scaffold). Alur yang diwajibkan prompt:
  1. `get_template_structure` (urutan & section wajib mengikat),
  2. `search_context` untuk bukti referensi,
  3. `draft_brd` sebagai baseline validasi,
  4. tulis markdown final sebagai jawaban.
- **Tool**: `draft_brd` (`packages/agent/src/tools/brd-drafting.ts`) — menyusun scaffold dari template + memvalidasi section wajib/ID convention.
- **Quality gate**: `missingRequiredSections()` memeriksa section wajib template; jika kurang → satu kali retry penulisan.

```ts
// apps/api/src/modules/brd/services.ts — submitClarificationFlow()
const missing = missingRequiredSections(markdown, activeTemplate?.structure ?? null);
if (missing.length) {
  const retry = await collectAgent(agent, `${generatePrompt}\n\nKOREKSI: ... ${missing.join(", ")} ...`, context);
  if (retryMissing.length < missing.length && retryText) markdown = retryText;
}
```

- **Instruksi prompt**:
  - `packages/agent/src/prompt/generate.ts` — kedalaman konten, aturan MUST/SHOULD/MAY, GAP eksplisit, bahasa Indonesia, output markdown penuh.
  - `packages/agent/src/prompt/judge.ts` — checklist kecukupan (aktor, izin, workflow, validasi, integrasi, acceptance criteria, dst).
  - `packages/agent/src/prompt/instructions.ts` — aturan global (grounded, traceability, keamanan prompt-injection, bahasa).

### 2.5 Langkah 4 — Simpan BRD v1 & buka panel dokumen

- **Maksud**: markdown hasil agen dipersist sebagai `BrdDocument` + `BrdVersion` ke-1 dengan status `DRAFT`.
- **Endpoint**: `POST /brd` → `createBrd()` (`apps/api/src/modules/brd/services.ts`).

```ts
// apps/platform/src/routes/workspace.tsx — persistV1()
const created = await createBrd({
  sessionId: activeId, title: "New BRD",
  contentMarkdown: base.trim(), changeSummary: "Initial draft",
});
setBrdPaneVisible(true);          // Flow 1: panel BRD langsung tampil
await brdState.select(created.brd.id);
setPhase("BRD_ACTIVE");
```

Mode `BRD_ACTIVE` menampilkan split view: chat agen (kiri) + `DocumentPane` (kanan).

### 2.6 Peran konfigurasi agen per fase

`agentFor()` (`apps/api/src/modules/chat/services.ts`) merakit agen + cache berdasarkan fingerprint (settings, phase, BRD, template aktif):

```ts
allowedTools:
  phase === "CLARIFY"
    ? ["elicit_clarifications", "search_context", "get_active_brd", "web_search"]
    : phase === "GENERATE"
      ? ["draft_brd", "search_context", "get_template_structure", "get_active_brd", "web_search"]
      : phase === "QA"
        ? ["answer_brd_question", "modify_brd", "search_context", "get_active_brd", "web_search"]
        : undefined,
memory:
  phase === undefined || phase === "QA"
    ? { store: memory, savePolicy: "turn" }   // hanya chat interaktif yang disimpan
    : undefined,                               // CLARIFY/JUDGE/GENERATE stateless
```

- **Maksud**: fase flow tidak boleh mengotori riwayat chat sesi, sehingga transkrip tetap bersih setelah BRD v1.

---

## 3. Flow 2 — Import BRD Existing

> Tujuan: user yang sudah punya dokumen BRD (`.md`, `.docx`, `.pdf`) bisa langsung menjadikannya baseline v1 tanpa melewati wawancara klarifikasi, lalu berinteraksi lewat chat. Panel BRD sengaja tidak dibuka di awal.

### 3.1 Diagram state

```
EMPTY_SESSION ──(pilih "I already have a BRD" + file)──▶ Importing ──▶ BRD_ACTIVE (pane HIDDEN)
                                                                          │
                                                          (user minta modifikasi di chat)
                                                                          ▼
                                                      pending preview → pane AUTO-OPEN → Approve/Reject
```

### 3.2 UI pemilihan mode

`NewBrdPanel` (`apps/platform/src/modules/brd/new-brd-panel.tsx`) memiliki 2 mode:

- `"story"` → Flow 1 (tidak berubah).
- `"existing"` → input file `.md/.markdown/.docx/.pdf` + tombol **Import BRD**.

```tsx
<button type="button" onClick={() => setMode("existing")} /* ... */>
  <FileUp size={15} /> I already have a BRD
</button>
```

### 3.3 Langkah 1 — Upload file BRD

- **Maksud**: memakai ulang pipeline dokumen yang sudah ada (OCR/ekstraksi, halaman, embedding, sidebar) sehingga tidak ada parser duplikat.
- **Handler**: `importExisting(file)` (`apps/platform/src/routes/workspace.tsx`) → `POST /documents`.

```ts
const uploaded = await uploadDocument(activeId, file);
const processed = await waitForDocumentReady(activeId, uploaded.document.id);
```

Polling status dokumen (maks ±3 menit):

```ts
async function waitForDocumentReady(sessionId: string, documentId: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const { document } = await getDocument(sessionId, documentId);
    if (document.status === "READY" || document.status === "PENDING_CONFIRMATION") return document;
    if (document.status === "FAILED") throw new Error(document.error ?? "Document processing failed");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Document processing timed out");
}
```

### 3.4 Langkah 2 — Buat BRD v1 dari konten dokumen

- **Endpoint**: `POST /brd/import` (`apps/api/src/modules/brd/router.ts`), schema `BrdImportSchema` (`apps/api/src/lib/api-contract.ts`).
- **Service**: `importBrdFromDocument()` (`apps/api/src/modules/brd/services.ts`).

```ts
// apps/api/src/modules/brd/services.ts
export async function importBrdFromDocument(userId: string, input: BrdImportInput) {
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, userId, sessionId: input.sessionId,
             status: { in: ["READY", "PENDING_CONFIRMATION"] } },
  });
  if (!document) return null;
  const pages = await prisma.documentPage.findMany({
    where: { documentId: document.id }, orderBy: { pageNumber: "asc" },
  });
  const contentMarkdown = pages.map((page) => page.content.trim()).filter(Boolean).join("\n\n");
  if (!contentMarkdown) return null;
  return createBrd(userId, {
    sessionId: input.sessionId,
    title: input.title ?? (document.title.replace(/\.[^.]+$/, "").trim() || "Imported BRD"),
    contentMarkdown,
    changeSummary: "Imported from existing BRD",
  });
}
```

- **Hasil**: `BrdDocument` v1 + file asli tetap terdaftar di tabel `Document` (muncul di sidebar kiri, bisa di-mention).

### 3.5 Langkah 3 — Panel BRD disembunyikan, chat jadi fokus

```tsx
// apps/platform/src/routes/workspace.tsx — importExisting()
setBrdPaneVisible(false);                        // pane tidak muncul sebelum diminta
await brdState.select(imported.brd.id);
setDraft(imported.brd.contentMarkdown);
setPhase("BRD_ACTIVE");
setNotice(`BRD existing "${imported.brd.title}" berhasil diimpor. ...`);
```

### 3.6 Langkah 4 — Panel auto-terbuka saat ada pending modification

Setelah setiap run chat selesai, state BRD di-refresh; jika agen men-stage perubahan (`pendingContentMarkdown`), panel otomatis terbuka agar user bisa Approve/Reject:

```tsx
// apps/platform/src/routes/workspace.tsx
const pendingModification = brdState.active?.pendingContentMarkdown ?? null;
useEffect(() => {
  if (pendingModification) setBrdPaneVisible(true);
}, [pendingModification]);
```

```tsx
<AnviaChat
  onRunEnded={() => {
    void refreshAfterRun();
    void brdState.refresh();      // refetch BRD aktif → memunculkan pending preview
  }}
/>
```

Versioning setelah approve identik dengan Flow 1 (lihat §6).

---

## 4. Manajemen File Sesi

> Tujuan: semua file (dokumen/flowchart) yang diunggah—dari sidebar maupun paperclip—menjadi konteks yang ter-grounding untuk agen, terdaftar di sidebar, bisa di-mention, dan bisa dihapus bersih dari storage + DB + vector.

### 4.1 Pintu upload

| Pintu | Komponen | Batas ukuran | Perilaku |
|---|---|---|---|
| Sidebar kiri "Session documents" | `session-sidebar.tsx` → `useDocuments()` | 50MB (server, `MAX_UPLOAD_BYTES`) | Upload banyak file sekaligus, daftar file + status + hapus |
| Paperclip di composer chat | `anvia-chat.tsx` → `attachFiles()` | **10MB (client)** | Upload langsung, preview chip, hapus = hapus permanen |
| Panel New BRD "Attach reference" (Flow 1) | `new-brd-panel.tsx` → `generate()` | 50MB | Rujukan konteks sebelum generate |
| Panel import BRD (Flow 2) | `new-brd-panel.tsx` → `importExisting()` | 50MB | Sumber BRD existing |

Validasi 10MB paperclip (dapat diubah di satu tempat):

```ts
// apps/platform/src/modules/chat/anvia-chat.tsx
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
// ...
if (file.size > MAX_ATTACHMENT_BYTES) {
  setUploadError(`${file.name} melebihi batas 10MB.`);
  continue;
}
```

### 4.2 Langkah upload di backend

- **Endpoint**: `POST /documents` (`apps/api/src/modules/document/router.ts`), multipart `file`, header `x-conversation-id`.
- **Maksud**: validasi ukuran/MIME → simpan ke R2 → catat `Document` (status `UPLOADING`) → enqueue job `process-document`.

```ts
// apps/api/src/modules/document/router.ts
const objectKey = await uploadDocument(file);
const document = await prisma.document.create({
  data: { userId, sessionId, title: file.name, fileType: documentFileType(file),
          storageUrl, objectKey, fileSize: file.size, isTemplate: form.get("isTemplate") === "true",
          status: "UPLOADING" },
});
await documentQueue.add("process-document", { documentId: document.id, objectKey }, retryPolicies.ingestion);
```

Deteksi tipe file (`apps/api/src/modules/document/types.ts`): `PDF`, `MARKDOWN`, `DOCX`, `IMAGE_FLOWCHART` (semua `image/*` — diperlakukan sebagai gambar referensi), sisanya `OTHER`.

### 4.3 Worker `process-document` — ekstraksi + embedding

File: `apps/api/src/worker/process-document.ts`, queue `doc-ingestion` (`apps/api/src/lib/queue.ts`).

- **Maksud**: mengubah file menjadi teks per halaman + ringkasan + vektor yang bisa dicari.
- Ekstraksi:
  - `MARKDOWN` → baca langsung.
  - `DOCX` → `mammoth.extractRawText`.
  - `PDF`/lainnya → **Mistral OCR** (`mistral-ocr-latest`) mempertahankan tabel/gambar/heading.
- Ringkasan dokumen via LLM (`gpt-4o-mini`) untuk non-Markdown.
- Simpan halaman ke `DocumentPage`, buat embedding 384 dimensi, upsert ke Qdrant koleksi `documents` dengan metadata `userId`, `sessionId`, `documentId`, `documentName`, `pageNumber`.

```ts
const embedded = await embedDocuments({
  model: await embeddingModel(),
  documents: pages,
  id: (page) => `${document.id}-page-${page.pageNumber - 1}`,
  content: (page) => page.content,
  metadata: (page) => ({ documentId: document.id, documentName: document.title,
                         userId: document.userId, sessionId: document.sessionId,
                         pageNumber: page.pageNumber, metadata: JSON.stringify(page.metadata) }),
});
await vectorStore.upsert({ documents: embedded.documents });
```

- Setelah `READY`, jika `isTemplate` → enqueue `template-extract` (lihat §7).

### 4.4 Gambar referensi

Semua gambar (`image/*` → `IMAGE_FLOWCHART`) diproses oleh worker yang sama dengan dokumen lain (`doc-ingestion`). Mistral OCR mengekstrak isi gambar menjadi halaman teks yang di-embed ke Qdrant, sehingga gambar apa pun (flowchart, wireframe, tangkapan layar) menjadi konteks sesi yang bisa dicari oleh agen. Tidak ada lagi worker verifikasi atau perbandingan otomatis terhadap BRD.

### 4.5 Paperclip: preview chip & hapus permanen

File: `apps/platform/src/modules/chat/anvia-chat.tsx`.

- **Maksud**: memberi pengalaman seperti chat agent umum—file tampil sebagai chip (thumbnail jika gambar, ikon + nama jika dokumen) dan bisa dihapus sebelum pesan dikirim. Setelah run selesai, chip dibersihkan otomatis tetapi file tetap tersimpan di sidebar.
- Upload terjadi segera saat file dipilih; chip `uploading` menampilkan spinner, lalu `ready` menampilkan tombol `X`.
- Menghapus chip = memanggil `DELETE /documents/:id` (hapus permanen).

```tsx
const removeUpload = useCallback(async (item: SessionUpload) => {
  if (item.status !== "ready") return;
  setUploads((prev) => prev.filter((entry) => entry.key !== item.key));
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  if (!item.documentId) return;
  await deleteDocument(sessionId, item.documentId);
  refreshSessionDocuments();     // sidebar ikut ter-update
}, [refreshSessionDocuments, sessionId]);
```

- Setelah run chat selesai, chip lampiran **dan** chip mention dibersihkan otomatis (file tetap ada di sidebar):

```tsx
onEvent: (event) => {
  if (event.type === "run_end" || event.type === "error") {
    clearComposerContext();   // bersihkan uploads + mentions + revoke object URL
    onRunEnded?.();
  }
},
```

### 4.6 File terunggah otomatis menjadi konteks pesan

- **Maksud**: file yang dilampirkan lewat paperclip (atau di-mention) tidak perlu di-query manual; ID + nama file dikirim sebagai metadata, lalu konten hasil ekstraksi/OCR-nya **disuntikkan langsung ke prompt agen** (bukan hanya instruksi mencari), sehingga agen tidak pernah menjawab "tidak punya OCR".

```tsx
// anvia-chat.tsx — body(transport)
const files = contextFilesRef.current;              // gabungan upload siap + mention
const attachedFiles = files.map((item) => item.name);
const attachedDocumentIds = files.map((item) => item.id);
const metadata = { ...requestMetadata,
  ...(brdDocumentId ? { phase: "QA", brdDocumentId } : {}),
  ...(attachedFiles.length ? { attachedFiles, attachedDocumentIds } : {}) };
```

```ts
// apps/api/src/modules/chat/router.ts
const attachmentBlock = attachedDocumentIds.length
  ? await attachmentContextBlock(userId, sessionId, attachedDocumentIds)
  : "";
const contextBlock = attachmentBlock || fileInstruction;
const promptContent = contextBlock
  ? [messageText(latest.content), contextBlock].filter(Boolean).join("\n\n")
  : latest.content;
```

- `attachmentContextBlock()` (`apps/api/src/modules/chat/services.ts`) mengambil `DocumentPage` (hasil OCR/ekstraksi) milik dokumen yang dirujuk, dibatasi ±6000 karakter, dan menyertakan status bila file masih diproses:

```ts
if (document.status !== "READY" && document.status !== "PENDING_CONFIRMATION") {
  blocks.push(`### File: ${document.title}\n(status: ${document.status} — masih diproses; beri tahu user untuk menunggu sebentar lalu coba lagi)`);
}
```

- `messageText()` mengekstrak teks dari `content` yang bisa berupa string atau array part—mencegah bug teks pesan berubah menjadi `"[object Object]"` saat ada lampiran.
- Rincian lengkap tahap tulis DB → OCR → upsert Qdrant ada di **§4.8**.

### 4.7 Hapus dokumen — bersih di tiga tempat

File: `apps/api/src/modules/document/router.ts`.

```ts
try {
  await deleteDocumentVectors(document.id);               // 1) Qdrant by payload filter documentId
} catch (error) {
  console.warn("Failed to delete document vectors", { documentId: document.id, error });
}
await deleteDocument(document.objectKey);                // 2) R2 storage
await prisma.document.delete({ where: { id: document.id } }); // 3) DB (DocumentPage cascade)
```

- **Maksud**: mencegah data "hantu" yang masih bisa ter-retrieve oleh `search_context` setelah file dihapus user.
- Vector dihapus lewat filter payload `documentId` (`deleteDocumentVectors`), jadi tidak bergantung pada jumlah halaman yang tersimpan dan tidak bisa tertinggal saat ada drift.
- Vector deletion bersifat best-effort agar penghapusan tetap berhasil saat Qdrant sedang down.

### 4.8 Peta data end-to-end: PostgreSQL → OCR → Qdrant

> Ringkasan "data masuk ke tabel apa, OCR-nya bagaimana, dan kapan vektor di-upsert", berlaku untuk upload sidebar, paperclip, import BRD, dan template.

#### A. Urutan status & tabel yang ditulis

| Tahap | Lokasi kode | Tabel / storage | Data yang ditulis |
|---|---|---|---|
| Upload file | `document/router.ts` (`POST /documents`) | R2 (objek) + PostgreSQL `Document` | `objectKey` (unik), `storageUrl`, `title`, `fileType`, `fileSize`, `userId`, `sessionId`, `isTemplate`, `status = UPLOADING` |
| Worker mulai | `worker/process-document.ts` | `Document` | `status = PROCESSING`, `error = null` |
| OCR / ekstraksi | `worker/process-document.ts` | — (di memori) | `pages[] = { pageNumber, content, metadata }` |
| Simpan halaman + ringkasan | `persistPages()` | `DocumentPage` + `Document` | `deleteMany` halaman lama → `createMany` per halaman (`pageNumber`, `content`, `metadata`); `Document.summary` (LLM, hanya non-Markdown) |
| Embedding + index | `embedDocuments` → `vectorStore.upsert` | Qdrant koleksi `documents` | 1 point per halaman (lihat bagian C) |
| Selesai | `worker/process-document.ts` | `Document` | `status = READY` |
| Ekstraksi template | `worker/extract-template.ts` | `Document` | `templateStructure` (JSON), `status = PENDING_CONFIRMATION` |
| Gagal di tahap mana pun | worker | `Document` | `status = FAILED`, `error` (dipotong 1000 karakter) |

- `DocumentPage.documentId` memakai `onDelete: Cascade` (`apps/api/prisma/schema.prisma`), sehingga menghapus `Document` otomatis menghapus halaman-halamannya.
- `Document` juga menyimpan `summary` (teks) dan `templateStructure` (JSON) sesuai jenis pemrosesan.

#### B. Proses OCR (Mistral OCR)

Hanya file PDF dan `OTHER` yang melewati OCR; DOCX memakai `mammoth.extractRawText`, Markdown dibaca langsung.

```ts
// apps/api/src/worker/process-document.ts
const mistral = new MistralClient({ apiKey: process.env.MISTRAL_API_KEY ?? "" });
const ocrModel = mistral.ocrModel({ modelId: process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-latest" });
// ...
const result = await ocrModel.ocr({
  source: { type: "document_url", url: documentUrl(document.objectKey) }, // URL publik R2
  includeImageBase64: false,
});
pages = result.pages.map((page) => ({
  pageNumber: page.index + 1,
  content: page.markdown,                       // hasil OCR sebagai Markdown per halaman
  metadata: JSON.parse(JSON.stringify({
    images: page.images, tables: page.tables ?? [], hyperlinks: page.hyperlinks ?? [],
    header: page.header ?? null, footer: page.footer ?? null,
    dimensions: page.dimensions ?? null, confidenceScores: page.confidenceScores ?? null,
  })),
}));
```

- `documentUrl(objectKey)` (`apps/api/src/modules/document/services.ts`) menggabungkan `R2_PUBLIC_BASE_URL` + object key agar Mistral bisa mengambil file.
- Gambar referensi melewati panggilan OCR yang sama (jalur `OTHER`/gambar pada worker `process-document`), lalu halaman + vektor disimpan seperti dokumen lain.
- Untuk PDF hasil scan tanpa layer teks, OCR inilah sumber teks yang nanti dikutip agen (grounded per halaman).

#### C. Upsert ke Qdrant

Konfigurasi store (dipakai worker dan pencarian):

```ts
const qdrant = new QdrantVectorClient({ url: process.env.QDRANT_URL ?? "http://127.0.0.1:6333" });
const vectorStore = qdrant.vectorStore({ collectionName: "documents", dimensions: 384, metric: "cosine" });
```

Alur upsert:

```ts
const embedded = await embedDocuments({
  model: await embeddingModel(),                               // model embedding lokal, 384 dimensi
  documents: pages,
  id: (page) => `${document.id}-page-${page.pageNumber - 1}`,  // ID point deterministik
  content: (page) => page.content,
  metadata: (page) => ({
    documentId: document.id, documentName: document.title,
    userId: document.userId, sessionId: document.sessionId,
    pageNumber: page.pageNumber, metadata: JSON.stringify(page.metadata),
  }),
});
await ensureVectorStore();              // vectorStore.ensure(), di-cache agar sekali per proses
await vectorStore.upsert({ documents: embedded.documents });
```

- **1 halaman = 1 point Qdrant**; ID point `{documentId}-page-{index}` (index mulai 0) sehingga update/delete tidak butuh ID internal Qdrant.
- Ingest ulang: `deleteMany` + `createMany` di PostgreSQL dan `upsert` Qdrant memakai ID sama → tidak ada duplikasi.
- Hapus file memakai filter payload: `deleteDocumentVectors(documentId)` menghapus semua point yang memiliki `documentId` tersebut (lihat §4.7).
- Pencarian `search_context` memfilter payload `userId` + `sessionId`, sehingga hasil selalu session-scoped.
- Kolom `metadata` payload berisi JSON string dari metadata halaman OCR (images/tables/hyperlinks/dimensions), sementara field title diambil dari `documentName`.

#### D. Tabel lain yang ikut terisi

| Aksi | Tabel | Catatan |
|---|---|---|
| Buat/ubah/hapus sesi | `AgentMemorySession` | `scopeKey` unik per (sessionId, userId); judul diisi dari pesan pertama |
| Chat QA (memori) | `AgentMemoryMessage` (+ `AgentMemoryError` saat run gagal) | hanya QA/chat interaktif yang disimpan (`savePolicy: "turn"`) |
| Simpan BRD v1 / import | `BrdDocument` + `BrdVersion` | versi 1 + `currentVersion = 1`, status `DRAFT` |
| Approve modifikasi | `BrdVersion` + update `BrdDocument` | versi baru + `pendingContentMarkdown` dibersihkan |
| Settings / approve template | `UserSetting` | `theme`, `systemPrompt`, `activeTemplateId` |
| Upload template | `Document` (`isTemplate = true`) | `templateStructure` terisi setelah worker `template-extract` |

---

## 5. @Mention File dalam Sesi

> Tujuan: user dapat merujuk file di sesi yang sama sebagai konteks pertanyaan/perintah, tanpa kemampuan lintas sesi.

### 5.1 Popover mention (frontend)

File: `apps/platform/src/modules/brd/mention-popover.tsx`.

- Mencari **hanya dokumen pada sesi aktif** (`type=document&sessionId=...`).

```tsx
const resultsQuery = useQuery({
  queryKey: ["search", "session-files", trimmed, sessionId],
  queryFn: () => search(trimmed, "document", sessionId).then((response) => response.results),
  enabled: trimmed.length > 0,
  staleTime: 30_000,
});
```

- Penyisipan teks mention memakai `composer.setInput` (library `@anvia/react-ui`), bukan manipulasi DOM. Insertion dibuat robust untuk dua jalur pembuka popover (mengetik `@` di textarea atau klik tombol `AtSign`):

```tsx
// anvia-chat.tsx — MentionDock.onPick
const mention = `@${result.title} `;
const current = composer.input;
const next = /@([^\s@]*)$/.test(current)
  ? current.replace(/@([^\s@]*)$/, mention)          // ganti trigger yang sedang diketik
  : `${current}${current && !current.endsWith(" ") ? " " : ""}${mention}`; // tombol @: append
composer.setInput(next);
onPicked({ id: result.id, name: result.title });      // chip indikator mention
onClose();
```

- Popover dibuka dengan mengetik `@` (pola regex di textarea) atau klik tombol `AtSign`.
- Setelah file dipilih, teks `@nama-file` disisipkan ke input **dan** muncul chip indikator `MentionChips` di atas composer (ikon `@` + nama file) yang bisa dihapus—menghapus chip juga menghapus teks `@nama-file` dari input. Chip ini dikirim sebagai `attachedDocumentIds` sehingga konten file ikut disuntikkan ke prompt (lihat §4.6).

### 5.2 Pencarian backend

- **Endpoint**: `GET /search?q=...&type=document&sessionId=...` (`apps/api/src/modules/search/router.ts`).
- **Service**: `searchUserContent()` (`apps/api/src/modules/search/services.ts`) — filter `userId` + `sessionId` + judul (case-insensitive).

### 5.3 Resolusi oleh agen

- Jalur utama: chip mention mengirim `attachedDocumentIds` di metadata, lalu backend menyuntikkan konten hasil ekstraksi/OCR langsung ke prompt (`attachmentContextBlock`, lihat §4.6). Jadi agen sudah memegang isi file tanpa harus menebak.
- Pelengkap: prompt global mewajibkan `search_context` saat ada `@filename` atau lampiran, untuk mengambil bagian dokumen yang tidak ikut tersuntik (dokumen besar):

```ts
// packages/agent/src/prompt/instructions.ts (Operating principles / Tool-use rules)
- When the user mentions a session file with @filename, or the current message lists attached files,
  MUST call search_context with the user's question plus the file name before answering.
  Never claim you cannot open or read files.
```

- Jika file adalah gambar referensi, agen membaca hasil OCR-nya lewat `search_context` seperti dokumen lain.
- Hasil `search_context` menyertakan judul dokumen + nomor halaman agar agen bisa mengutip sumber:

```ts
// packages/agent/src/tools/context.ts
export const ContextChunkSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().nullable().optional(),
  pageNumber: z.number().int().positive().nullable(),
  content: z.string(),
  score: z.number().finite(),
});
```

---

## 6. QA, Modifikasi BRD, Approval, Versioning & Export

### 6.1 Chat QA terhadap BRD

- Frontend mengirim metadata `{ phase: "QA", brdDocumentId }` saat BRD aktif (`anvia-chat.tsx`).
- Backend memilih fase QA dan menyuntikkan BRD aktif via adapters:

```ts
// apps/api/src/modules/chat/router.ts
const phase = metadata?.brdDocumentId ? "QA" : metadata?.phase;
const agent = await agentFor(userId, sessionId, phase, metadata?.brdDocumentId);
```

- Prompt QA (`packages/agent/src/prompt/qa.ts`) mengatur klasifikasi intent: pertanyaan faktual → `answer_brd_question`; permintaan perubahan eksplisit → `modify_brd`; ambigu → satu pertanyaan klarifikasi.

### 6.2 Modifikasi BRD sebagai pending preview

- **Tool**: `modify_brd` (`packages/agent/src/tools/brd-modification.ts`) — menambah/mengubah/menghapus section `FR-/BR-`, selalu `persisted: false`.
- **Interception di server**: ketika tool `modify_brd` selesai, hasilnya tidak langsung disimpan; server men-stage ke kolom `pendingContentMarkdown`.

```ts
// apps/api/src/modules/chat/router.ts
if (event.type === "tool_result" && event.toolName === "modify_brd" && event.output?.type === "json") {
  const output = event.output.value as { updatedMarkdown?: string; changeSummary?: string; userNotice?: string };
  if (output.updatedMarkdown) {
    await stageBrdModification(userId, metadata?.brdDocumentId ?? "", output.updatedMarkdown, output.changeSummary ?? "Pending BRD modification");
    yield { ...event, output: { ...event.output, value: { ...output, persisted: false,
      userNotice: output.userNotice ?? "BRD berhasil dimodifikasi sebagai preview. Silakan approve di panel BRD." } } };
    continue;
  }
}
```

- **Maksud**: human-in-the-loop—perubahan tidak pernah masuk versi tersimpan tanpa persetujuan user.

### 6.3 Approval (versi baru) & Reject

- **Endpoint**: `POST /brd/:id/approve-modification` dan `POST /brd/:id/reject-modification`.
- **Service**: `approveBrdModification()` / `rejectBrdModification()` (`apps/api/src/modules/brd/services.ts`).

```ts
// approve: buat BrdVersion baru dari pendingContentMarkdown, lalu bersihkan pending
const version = await tx.brdVersion.create({ data: {
  brdDocumentId: id, versionNumber: nextVersion, contentMarkdown: pendingContent,
  changeSummary: brd.pendingChangeSummary ?? "Approved BRD modification", createdBy: "AI_AGENT",
} });
```

- **UI**: `DocumentPane` (`apps/platform/src/modules/brd/document-pane.tsx`) menampilkan badge "Pending modification" + tombol Approve/Reject.

### 6.4 Versioning, diff, restore

- Model: `BrdDocument` (currentVersion, contentMarkdown) + `BrdVersion` (unique per `brdDocumentId` + `versionNumber`) — `apps/api/prisma/schema.prisma`.
- `updateBrd()` hanya membuat versi baru jika konten berubah.
- `diffBrdVersions()` memakai `simpleDiff()` (`apps/api/src/modules/brd/utils.ts`).
- `restoreBrdVersion()` membuat versi baru berisi konten versi lama (bukan menimpa riwayat).
- **UI**: dropdown versi + tombol Restore di `DocumentPane`; hook `useVersionHistory()`.

### 6.5 Export Markdown & PDF

- **Endpoint**: `GET /brd/:id/export/markdown` dan `GET /brd/:id/export/pdf` (`apps/api/src/modules/brd/router.ts`).
- **Maksud**: membawa dokumen keluar aplikasi; PDF dibuat dengan generator PDF minimal tanpa dependensi eksternal (`buildPdf()` di `apps/api/src/modules/brd/utils.ts`).

```ts
// apps/platform/src/lib/api.ts — exportBrd()
const response = await fetch(`${API_BASE}/brd/${encodeURIComponent(id)}/export/${format}`, {
  headers: { "x-user-id": DEMO_USER_ID },
});
```

---

## 7. Template BRD

> Tujuan: sekali upload standar BRD perusahaan, strukturnya diekstrak dan dipakai konsisten untuk semua draft berikutnya setelah disetujui (Approval Gate).

### 7.1 Upload template

- **Endpoint**: `POST /settings/template` (`apps/api/src/modules/settings/router.ts`).
- **Service**: `uploadTemplate()` + `enqueueTemplateProcess()` (`apps/api/src/modules/settings/services.ts`).
- **Maksud**: dokumen bertanda `isTemplate: true` masuk pipeline dokumen yang sama (OCR/ekstraksi/embedding), lalu memicu job `template-extract` setelah `READY`.

### 7.2 Ekstraksi struktur

- **Worker**: `apps/api/src/worker/extract-template.ts` (queue `template-extract`).
- **Maksud**: mengabstraksi dokumen menjadi struktur reusable—judul & urutan section, required/optional, purpose, format, konvensi ID, bahasa, gaya acceptance—tanpa menyalin konten bisnis.

```ts
const result = await generateCompletion({
  model, instructions: TEMPLATE_EXTRACTION_INSTRUCTIONS, prompt: content,
  outputSchema: TemplateExtractionSchema,     // structured output OpenAI
});
const normalized = normalizeTemplateStructure(result.output);
await prisma.document.update({ where: { id: document.id },
  data: { templateStructure: normalized as object, status: "PENDING_CONFIRMATION" } });
```

### 7.3 Review & approval

- `GET /settings/template/:id`, `PATCH /settings/template/:id` (edit struktur), `POST /settings/template/:id/approve`, `POST /settings/template/:id/reject`, `POST /settings/template/reset`.
- **Maksud approve**: menyimpan `activeTemplateId` di `UserSetting` dan menandai dokumen `READY`.

```ts
// apps/api/src/modules/settings/services.ts — approveTemplate()
await prisma.$transaction([
  prisma.userSetting.upsert({ where: { userId },
    create: { userId, activeTemplateId: document.id },
    update: { activeTemplateId: document.id } }),
  prisma.document.update({ where: { id: document.id }, data: { status: "READY" } }),
]);
```

### 7.4 Pemakaian template di flow BRD

- `activeTemplateFor()` (`apps/api/src/modules/chat/services.ts`) mengambil template aktif per user.
- `templateInstructionBlock()` (`packages/agent/src/tools/brd-drafting.ts`) mengubahnya menjadi instruksi mengikat untuk agen (urutan section, required, konvensi ID).
- Pada CLARIFY: pertanyaan diarahkan mengisi section wajib.
- Pada GENERATE: BRD final wajib memuat section wajib; jika tidak → retry sekali; jika masih kurang → dicatat sebagai GAP.
- `draft_brd` memvalidasi markdown terhadap template: `validateBrdAgainstTemplate()`.

---

## 8. Sesi & Memori Percakapan

- **Endpoint**: `GET/POST/PATCH/DELETE /sessions`, `GET /sessions/:id/messages` (`apps/api/src/modules/session/router.ts`).
- **Service**: `apps/api/src/modules/session/service.ts`.
- **Maksud**: sesi = percakapan + ruang lingkup dokumen (session-scoped). Memori agen disimpan di tabel `AgentMemorySession`/`AgentMemoryMessage` melalui `PrismaMemoryStore` (`apps/api/src/modules/chat/services.ts`).

```ts
const memory = new PrismaMemoryStore({ client: prisma, scopeKey: { metadataKeys: ["userId"] } });
```

- Judul sesi otomatis diambil dari pesan pertama:

```ts
// apps/api/src/modules/chat/router.ts
await titleSessionFromFirstMessage(userId, sessionId, latest.content);
```

- Chat streaming diproses di `POST /chat` memakai `agentToClientStream` + `createClientStreamResponse`.
- Hapus sesi membersihkan storage (best-effort) lebih dulu, lalu menghapus baris DB dalam satu transaksi:

```ts
// apps/api/src/modules/session/service.ts — deleteSession()
// 1) best-effort: deleteDocumentVectors(id) + deleteDocument(objectKey) per dokumen
await prisma.$transaction([
  prisma.document.deleteMany({ where: { sessionId, userId } }),
  prisma.brdDocument.deleteMany({ where: { sessionId, userId } }),
  prisma.agentMemoryMessage.deleteMany({ where: { memorySessionId: session.id } }),
  prisma.agentMemorySession.delete({ where: { id: session.id } }),
]);
```

- Worker (`process-document`, `extract-template`) memeriksa ulang keberadaan dokumen sebelum menulis halaman/vektor dan menelan error `P2025`, sehingga menghapus dokumen/sesi saat pemrosesan berjalan tidak meninggalkan ghost vector.

---

## 9. Settings

- **Endpoint**: `GET /settings`, `PATCH /settings` (`apps/api/src/modules/settings/router.ts`).
- **Maksud**: hanya preferensi user yang dapat diubah dari UI (`theme`, `systemPrompt`). Provider/model/baseUrl/API key bersifat server-managed via env (PRD §4H), sehingga tidak bisa diubah per user dari client.

```ts
// apps/api/src/lib/api-contract.ts
export const SettingsPatchSchema = z.object({
  theme: z.string().trim().min(1).max(40).optional(),
  systemPrompt: z.string().max(20_000).nullable().optional(),
});
```

---

## 10. Ringkasan Endpoint API

| Method & Path | Modul | Fungsi |
|---|---|---|
| `POST /chat` | `chat/router.ts` | Streaming chat agen (QA/generate), staging `modify_brd`, injeksi konten file terlampir |
| `GET/POST /sessions` | `session/router.ts` | List/buat sesi |
| `PATCH/DELETE /sessions/:id` | `session/router.ts` | Rename/update/hapus sesi |
| `GET /sessions/:id/messages` | `session/router.ts` | Riwayat pesan sesi |
| `GET /documents` | `document/router.ts` | Daftar file sesi (sidebar) |
| `POST /documents` | `document/router.ts` | Upload file → queue `doc-ingestion` |
| `GET /documents/:id` | `document/router.ts` | Detail + status dokumen (polling import) |
| `DELETE /documents/:id` | `document/router.ts` | Hapus R2 + DB + vektor Qdrant |
| `POST /brd/clarify` | `brd/router.ts` | Round 1 klarifikasi (fase CLARIFY) |
| `POST /brd/submit-clarification` | `brd/router.ts` | Judge → round 2 / generate BRD |
| `POST /brd` | `brd/router.ts` | Simpan BRD v1 (Flow 1) |
| `POST /brd/import` | `brd/router.ts` | Import BRD existing (Flow 2) |
| `GET /brd?sessionId=` | `brd/router.ts` | List BRD per sesi |
| `GET/PATCH/DELETE /brd/:id` | `brd/router.ts` | Detail/update/hapus BRD |
| `POST /brd/:id/versions` | `brd/router.ts` | Tambah versi manual |
| `GET /brd/:id/diff?from=&to=` | `brd/router.ts` | Diff antar versi |
| `POST /brd/:id/restore` | `brd/router.ts` | Restore versi lama sebagai versi baru |
| `POST /brd/:id/approve-modification` | `brd/router.ts` | Approve pending preview → versi baru |
| `POST /brd/:id/reject-modification` | `brd/router.ts` | Buang pending preview |
| `GET /brd/:id/export/markdown` | `brd/router.ts` | Export `.md` |
| `GET /brd/:id/export/pdf` | `brd/router.ts` | Export `.pdf` |
| `GET /search?q=&type=&sessionId=` | `search/router.ts` | Pencarian file/BRD per sesi (mention) |
| `GET/PATCH /settings` | `settings/router.ts` | Preferensi user |
| `POST /settings/template` | `settings/router.ts` | Upload template BRD |
| `GET/PATCH /settings/template/:id` | `settings/router.ts` | Lihat/edit struktur template |
| `POST /settings/template/:id/approve` | `settings/router.ts` | Aktifkan template |
| `POST /settings/template/:id/reject` | `settings/router.ts` | Tolak template |
| `POST /settings/template/reset` | `settings/router.ts` | Hapus template aktif |

---

## 11. Peta File Penting

### Backend — API

| File | Peran |
|---|---|
| `apps/api/src/index.ts` | Bootstrap Hono + CORS + mounting route |
| `apps/api/src/lib/api-contract.ts` | Schema Zod request/response (termasuk `BrdImportSchema`) |
| `apps/api/src/lib/queue.ts` | Definisi queue BullMQ + retry policy |
| `apps/api/src/lib/identity.ts` | Resolusi user dari header |
| `apps/api/src/modules/chat/router.ts` | Endpoint chat streaming, staging modifikasi BRD, ekstraksi teks pesan (`messageText`), injeksi konteks file (`attachmentContextBlock`) |
| `apps/api/src/modules/chat/services.ts` | Perakitan agen per fase, adapters konteks, template aktif, memory, `attachmentContextBlock` |
| `apps/api/src/modules/brd/router.ts` | Endpoint BRD (clarify, import, versi, export) |
| `apps/api/src/modules/brd/services.ts` | Logika BRD: clarify/judge/generate, import, versi, approval |
| `apps/api/src/modules/brd/utils.ts` | `simpleDiff`, `buildPdf`, helper body |
| `apps/api/src/modules/document/router.ts` | Upload/list/detail/delete dokumen + enqueue worker |
| `apps/api/src/modules/document/services.ts` | R2 upload/download/delete + delete vektor Qdrant |
| `apps/api/src/modules/document/types.ts` | Deteksi `DocumentFileType` |
| `apps/api/src/modules/session/service.ts` | CRUD sesi + judul otomatis + riwayat pesan |
| `apps/api/src/modules/settings/router.ts` | Settings + template (upload/approve/reset) |
| `apps/api/src/modules/settings/services.ts` | Logika settings & ekstraksi template |
| `apps/api/src/modules/search/services.ts` | Pencarian BRD/dokumen (filter sesi) |
| `apps/api/src/worker/process-document.ts` | Worker ingestion (OCR, summary, embedding) |
| `apps/api/src/worker/extract-template.ts` | Worker ekstraksi struktur template |

### Agent

| File | Peran |
|---|---|
| `packages/agent/src/agent.ts` | Factory `createSystemAnalystAgent` + pemilihan tools per fase |
| `packages/agent/src/prompt/instructions.ts` | Aturan global agen (grounded, keamanan, mention/lampiran) |
| `packages/agent/src/prompt/clarify.ts` | Instruksi fase CLARIFY |
| `packages/agent/src/prompt/judge.ts` | Instruksi fase JUDGE |
| `packages/agent/src/prompt/generate.ts` | Instruksi fase GENERATE + quality gate |
| `packages/agent/src/prompt/qa.ts` | Instruksi fase QA (tanya jawab & modifikasi) |
| `packages/agent/src/tools/clarifications.ts` | Tool `elicit_clarifications` |
| `packages/agent/src/tools/brd-drafting.ts` | Tool `draft_brd` + normalisasi/validasi template |
| `packages/agent/src/tools/brd-modification.ts` | Tool `modify_brd` (pending preview) |
| `packages/agent/src/tools/brd-question.ts` | Tool `answer_brd_question` |
| `packages/agent/src/tools/context.ts` / `context-search.ts` | Tipe & tool `search_context` |
| `packages/agent/src/tools/active-brd.ts` / `template-structure.ts` | Tool akses BRD aktif & struktur template |
| `packages/agent/src/schemas/judge.ts` | Schema output JUDGE |

### Frontend

| File | Peran |
|---|---|
| `apps/platform/src/routes/workspace.tsx` | Orkestrasi seluruh flow (state, import, panel, split view) |
| `apps/platform/src/modules/brd/new-brd-panel.tsx` | Pemilihan mode Flow 1 vs Flow 2 |
| `apps/platform/src/modules/brd/feedback-form.tsx` | Form klarifikasi (round 1/2) |
| `apps/platform/src/modules/brd/document-pane.tsx` | Panel BRD: versi, diff, restore, approve/reject, export |
| `apps/platform/src/modules/brd/mention-popover.tsx` | Popover `@` file sesi |
| `apps/platform/src/modules/chat/anvia-chat.tsx` | Composer chat: paperclip, chip preview, mention, metadata lampiran |
| `apps/platform/src/modules/chat/session-sidebar.tsx` | Sidebar sesi + upload/hapus/label dokumen |
| `apps/platform/src/modules/chat/message-bubble.tsx` | Render pesan + tool call + attachment |
| `apps/platform/src/modules/chat/hooks/use-documents.ts` | Query/mutation dokumen sesi |
| `apps/platform/src/modules/brd/hooks/use-brds.ts` | Query BRD aktif + refresh |
| `apps/platform/src/modules/brd/hooks/use-version-history.ts` | Diff/restore/versi |
| `apps/platform/src/lib/api.ts` | Semua pemanggilan HTTP API |
| `apps/platform/src/lib/types.ts` | Tipe data frontend (`DocumentSummary`, `BrdDocument`, dll) |

### Data & Infrastruktur

| File | Peran |
|---|---|
| `apps/api/prisma/schema.prisma` | Model: Session, Message, Document, DocumentPage, BrdDocument, BrdVersion, UserSetting |
| `apps/api/prisma/migrations/*` | Riwayat migrasi DB |
| `docker-compose.dev.yml` | Redis/Qdrant/Postgres untuk pengembangan |

---

## 12. Catatan & Batasan Saat Ini

1. **Limit 10MB** hanya divalidasi di client untuk paperclip (`MAX_ATTACHMENT_BYTES`); batas server tetap 50MB (`MAX_UPLOAD_BYTES`). Ubah di `apps/platform/src/modules/chat/anvia-chat.tsx` dan/atau `apps/api/src/modules/document/schema.ts`.
2. **Mention bersifat teks sederhana** (`@nama-file`) dan hanya dalam sesi yang sama; tidak ada lintas sesi.
3. **Teks `@mention` tidak diparse di backend**—yang dikirim adalah `attachedDocumentIds` dari chip mention; kontennya disuntikkan ke prompt (agen juga tetap diarahkan memakai `search_context` untuk bagian lain). Konsekuensinya, mengetik `@nama-file` manual tanpa memilih dari popover tidak memicu injeksi konten (hanya teks biasa + pencarian semantik jika agen memanggil `search_context`).
4. **Hapus sesi** sudah membersihkan objek R2, vektor Qdrant, `Document`, dan `BrdDocument` sesi (storage best-effort, DB transaksional). Jika Qdrant/R2 sedang down, kegagalan tercatat di log dan baris DB tetap dihapus.
5. **Worker dan prompt agen** berjalan dari `packages/agent/dist`; setelah mengubah `packages/agent/src`, jalankan `pnpm --filter @sa-ai-assistant/agent build` lalu restart API/worker (`pnpm dev`).
6. **Fase CLARIFY/JUDGE/GENERATE tidak menyimpan memori**; hanya chat interaktif (QA atau tanpa fase) yang menyimpan riwayat. Ini disengaja agar transkrip sesi tidak terisi pesan internal flow.
7. **Konten file yang dilampirkan/di-mention disuntikkan ke prompt** dengan batas ±6000 karakter (`MAX_ATTACHMENT_CONTEXT_CHARS` di `apps/api/src/modules/chat/services.ts`). Untuk dokumen besar, sisanya tetap bisa diambil agen lewat `search_context`.
