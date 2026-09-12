# PRD — System Analyst AI Assistant

## 1. Latar Belakang

Fase sebelum pengembangan kode (*before coding*) adalah tahap yang paling kritikal dan banyak memakan waktu dalam siklus pengembangan perangkat lunak:
- Analisis kebutuhan bisnis dari User Story atau *brief* *stakeholder*.
- Pengecekan konsistensi terhadap dokumen arsitektur, standar API, kamus data, dan regulasi internal perusahaan yang sudah ada.
- Penyusunan dokumen spesifikasi formal berupa **BRD (Business Requirements Document)** yang mendetail dan terstruktur sesuai template/standar perusahaan.
- Verifikasi logika alur sistem terhadap diagram alir (*flowchart* / proses bisnis) yang kerap diberikan dalam bentuk gambar atau diagram pindaian.

Seluruh pekerjaan tersebut bersifat repetitif, rentan terhadap *human error*, memakan waktu berhari-hari, dan sering kali menghasilkan inkonsistensi antar-dokumen. Akibatnya, System Analyst (SA) lebih banyak terbebani oleh pekerjaan administratif dokumentasi ketimbang fokus pada analisis arsitektur mendalam, mitigasi risiko teknis, dan pengambilan keputusan strategis.

Produk **System Analyst AI Assistant** hadir untuk mengotomasi pekerjaan repetitif penyusunan dan verifikasi spesifikasi teknis, sehingga SA dapat bertindak sebagai *reviewer* dan *decision-maker* dengan hasil kerja yang presisi, patuh standar, dan dapat ditelusuri (*traceable*).

---

## 2. Deskripsi Produk

**System Analyst AI Assistant** adalah platform asisten kecerdasan buatan terintegrasi (*end-to-end*) yang mendampingi System Analyst pada fase *before coding*. Sistem ini memanfaatkan arsitektur agen AI cerdas berbasis *context retrieval* (dokumen standar BRD internal, kamus data, dan riwayat proyek) untuk mengubah User Story menjadi BRD standar industri yang lengkap, terverifikasi, dan siap dieksekusi tim *engineering*.

Sistem dibangun dalam arsitektur modular yang terdiri dari 3 pilar utama:
1. **Core Agent (`packages/agent`)**: Engine penalaran AI berbasis Anvia SDK (`@anvia/core`) + LLM (OpenAI/ekivalen) yang dilengkapi *specialized tools* (BRD drafting, BRD modification, BRD Q&A, Flowchart verification, dan Context Retrieval via Qdrant/Tavily).
2. **Backend API & Async Worker (`apps/api`)**: Layanan API berbasis Node.js/Hono + Server-Sent Events (`@anvia/server`) dengan PostgreSQL & Prisma ORM (`@anvia/memory-prisma`), background worker asynchronous berbasis BullMQ & ioredis untuk task berat (OCR dokumen/gambar via `@anvia/mistral`, embedding via `@anvia/transformer`, indexing Qdrant via `@anvia/qdrant`), serta penyimpanan berkas dokumen di Cloudflare R2 via `@anvia/client-s3`.
3. **Web Platform (`apps/platform`)**: Aplikasi web modern berbasis React 19, Vite, TanStack Router, Tailwind CSS, shadcn/ui untuk layout dan komponen antarmuka, serta integrasi headless chat agent menggunakan `@anvia/react` dan `@anvia/react-ui`.

---

## 3. Target Pengguna & Persona

| Persona | Profil / Tanggung Jawab | Masalah Utama | Nilai Tambah dari Produk |
| :--- | :--- | :--- | :--- |
| **System Analyst (Primary)** | Menerjemahkan kebutuhan bisnis (*User Story*) menjadi spesifikasi teknis (*BRD*) sebelum tahap *coding*. | Butuh waktu lama menulis BRD dari nol; format BRD tidak seragam antar tim; kesulitan mencocokkan flowchart gambar dengan dokumen. | Memangkas waktu penyusunan BRD dari hari ke menit, otomatisasi adopsi template standar, validasi flowchart gambar, dan editor markdown fleksibel. |
| **Lead Architect / Engineering Manager** | Mengawasi kelayakan teknis dan kepatuhan standar sistem. | Spesifikasi dari SA sering ambigu, tidak mencantumkan batasan NFR atau format API yang seragam. | BRD memiliki struktur baku, menyertakan FR/NFR, batasan API, dan *traceability matrix* yang terstandarisasi. |
| **Product Manager (PM)** | Memberikan *User Story* dan memverifikasi cakupan fitur. | Sulit memvalidasi apakah BRD sudah mencakup seluruh skenario bisnis dan *edge cases*. | AI secara proaktif memberikan pertanyaan klarifikasi untuk memperjelas kebutuhan sebelum draf final dibentuk. |

---

## 4. Fitur Utama Sistem

### A. Kustomisasi Format BRD Berdasarkan Dokumen Standar Internal (*Template Adoption*)
- **Deskripsi:** Pengguna/perusahaan memiliki format dan gaya penulisan BRD tersendiri. Sistem memungkinkan user untuk mengunggah dokumen BRD standar/referensi internal perusahaan (format `.md`, `.pdf`, atau `.docx`).
- **Lokasi Upload (Global via Settings):** Upload dokumen standar dilakukan **halaman Settings → Template**, dengan skope **per-user global** (`UserSetting.activeTemplateId`). Template yang diekstrak jadi default untuk **semua sesi** user tersebut. (Scope org-wide/shared company dapat dibangun nanti; v1 per-user.)
- **Ekstraksi Struktur (Async Worker):** Upload dienkue ke queue `template-extract` (async). Worker mengekstrak dan menganalisis hierarki judul, bagian wajib, konvensi penomoran (misal `BR-XXX`, `REQ-XXX`), dan metadata dari dokumen standar tersebut. Status dokumen template: `UPLOADING → PROCESSING → PENDING_CONFIRMATION → READY` (approve) / `FAILED` (reject/error), dan hasil ekstraksi simpan di kolom `templateStructure` (Json).
- **Konfirmasi SA (Human-in-the-Loop):** Karena ekstraksi struktur via LLM heuristic, hasil **tidak pernah auto-apply**. Status template ending di `PENDING_CONFIRMATION`; SA review hasil ekstraksi di **Settings → Template** dan menklik **Approve** (→ set `activeTemplateId`) atau **Reject** (→ status `FAILED`). Template yang belum dikonfirmasi tidak diadopsi oleh sesi baru.
- **Pemberlakuan Template:** Format yang diekstrak dan **dikonfirmasi SA** disetel sebagai template aktif per-user global. Core Agent secara otomatis mengadopsi struktur tersebut saat menyusun draf BRD baru sehingga hasil draf selalu konsisten dengan standar perusahaan tanpa perlu penyesuaian manual berulang.
- **Hirarche & Precedence Template:**
  1. **Session override (ad-hoc):** sesi tertentu bisa memilih format lain secara episodik — simpan di `AgentMemorySession.metadata.templateId` via `PATCH /session`.
  2. **Project override:** `Project.templateId` — proyek tertentu bisa setel format berbeda.
  3. **Global (default):** `UserSetting.activeTemplateId` — template per-user, diadopsi oleh semua sesi baru.
  4. **Built-in default:** struktur BRD dasar bila tidak ada template yang disetel.

### B. Penyusunan BRD Berbasis User Story dengan Klarifikasi Proaktif (*Conversational Elicitation*)
- **Input Awal:** User memasukkan User Story mentah, *brief* singkat, atau catatan *stakeholder*.
- **Pemberian Umpan Balik & Pertanyaan Pendalaman (*Clarification Loop*):**
  - Agen tidak langsung membuat draf asumtif jika informasi bisnis belum lengkap.
  - Agen secara cerdas mendeteksi ambiguitas (misal: aturan otorisasi belum jelas, batas transaksi tidak terdefinisi, ketiadaan penanganan skenario gagal/timeout) dan merespons dengan **pertanyaan klarifikasi terfokus** kepada SA.
  - **Kontrak Output Struktur (Clarification Questions):** Agen tidak mengeluarkan pertanyaan sebagai teks freeform, melainkan sebagai **struktur JSON**:
    ```json
    {
      "clarification_questions": [
        { "id": "q1", "question": "Batas transaksi?", "options": ["<= 5M", "<= 100M", "Unlimited"], "required": true }
      ]
    }
    ```
    Frontend merender ini sebagai **feedback form**: radio/checkbox per pertanyaan + input **"isi sendiri"** (custom jawaban) + tombol **Submit**. Jawaban dipaket kembali ke agent sebagai user message berstruktur.
  - **Iteratif Rounds (*multi-round elicitation*):** Flow generasi = round-by-round:
    1. **Round 1:** agent output batch pertanyaan klarifikasi (max 2–3) → SA menjawab via feedback form → submit.
    2. **Round 2 (maksimum):** berdasarkan jawaban, jika ambiguitas masih ada, agent output batch pertanyaan terakhir (max 2–3) → SA menjawab → submit.
    3. **Generate:** setelah Round 2 atau ketika SA klik **"Generate BRD"** anytime, agen melanjutkan generate dengan asumtia eksplisit dilabel `ASSUMPTION` dalam BRD (per §9 prinsip no silent assumptions).
  - **Batasan Pertanyaan (*Loop Guard):** Maksimum **2 round** × **2–3 pertanyaan/round**. Tidak ada loop infinit.
- **Generasi Draf Final:** Setelah informasi mencukupi (atau cap round), agen menggabungkan User Story awal, jawaban klarifikasi, dan konteks dokumen acuan menjadi dokumen BRD lengkap sesuai format standar yang dipilih.

### B.1. BRD Generation UX State Machine (*Guided Stepper*)
State eksplisit di UI supaya flow prediktabel dan selaras dengan proyek:
- **Halaman root `/` = Landing page** — pengenalan fitur dan tata cara pakai (*what it does / how it works*), dengan CTA *Open workspace*. Ruang kerja aplikasi live di route **`/workspace`** (state machine di bawah berlaku di sana); sidebar navigasi sesi + modal Settings bisa diakses dari kedua halaman.
- **`EMPTY_SESSION`** — Sesi **belum ada `BrdDocument`** → UI menunjukkan **dedicated "New BRD" panel**: textarea User Story + file upload dokumen acuan (opsional) + tombol **"Generate BRD"**. (Bukan chat freeform; input user story via panel terdedicated.)
- **`CLARIFYING`** — Feedback form aktif (iteratif rounds, §4B). User menjawab pertanyaan klarifikasi, klik Submit.
- **`GENERATING`** — Agen stream draf BRD (SSE); UI menampilkan indikator streaming.
- **`BRD_ACTIVE`** — BRD v1 sudah diexist → layout post-generation: **Chat agent** + **Markdown editor** + **Version history** (§4C/§4F). Sesi yang ada BRD aktif langsung membuka state ini (skip user story panel).
- **Transisi:** `EMPTY_SESSION` → (klik Generate) → `CLARIFYING` → (jawaban submit) → `GENERATING` (loop back ke `CLARIFYING` max 1×) → `BRD_ACTIVE`. Jika SA klik **"Generate BRD"** langsung (skip klarifikasi), agent generate dengan `ASSUMPTION` label.

### C. Editor Markdown Interaktif & Ekspor Multi-Format (Markdown & PDF)
- **Editor Markdown Interaktif:**
  - BRD yang baru digenerate oleh AI langsung ditampilkan pada panel samping (*split-pane editor*) dalam format Markdown terstruktur.
  - SA dapat melakukan pengeditan langsung (*direct manual edit*) melalui form/editor Markdown (dengan *live preview* sintaks tabel, checklist, callout, dan headings).
- **Modifikasi Berbasis Perintah AI (*AI-Assisted Modification*):**
  - Selain edit manual, SA tetap dapat meminta AI merevisi bagian tertentu (misal: "Tambahkan skenario limit 3x percobaan login pada FR-002"). AI akan menghasilkan *delta update* yang secara otomatis diperbarui di editor markdown.
- **Persistensi BRD (*Save Flow / Human-in-the-Loop*):**
  - **v1 Auto-Create at Generate:** Klik tombol **"Generate BRD"** (human trigger eksplisit) → setelah draft stream komplit, frontend **auto-create `BrdDocument` v1** (`POST /brd`) → editor markdown langsung populate + version history mulai dari v1. Agen sendiri **tidak pernah menulis ke database**; trigger save selalu dari aksi manusia (Generate / Save / Approve delta).
  - **Save Versi Selanjutnya:** Edit manual SA → tombol **Save Version** → `BrdVersion` v2, v3, … baru. Modifikasi AI follow same flow: SA menyetujui delta update → frontend memberikan konten markdown terbaru → endpoint versi baru → `BrdVersion` + diff. Konten final selalu disimpan oleh frontend/API **sesudah review manusia**.
- **Ekspor Dokumen:**
  - **Ekspor Markdown (`.md`):** Mengunduh berkas markdown murni yang siap disimpan ke repositori Git / knowledge base (GitBook/Notion).
  - **Ekspor PDF (`.pdf`):** Mengunduh dokumen yang dirender rapi dengan stylesheet profesional (nomor halaman, kop dokumen, tabel terformat, dan penomoran bab otomatis).

### D. Tanya Jawab Cerdas Berdasarkan BRD Aktif (*Interactive BRD Q&A*)
- SA dapat menanyakan pertanyaan teknis spesifik seputar isi dokumen BRD yang sedang aktif atau dipilih (misal: *"Bagaimana alur kompensasi jika payment gateway timeout di FR-004?"*).
- **Resolusi "BRD Aktif":** Frontend memberikan `brdDocumentId` dalam metadata request chat; server mengambil `contentMarkdown` versi aktif dan menginject ke kontekst agent. Jika `brdDocumentId` tidak ada, Q&A mengkembali respons bahwa dokumen BRD belum diseleksi.
- Jawaban diberikan secara ketat (*grounded*) berdasarkan dokumen BRD tersebut. Jika informasi tidak ada di dokumen, AI tidak berhalusinasi, melainkan menyatakan secara eksplisit bahwa hal tersebut belum diatur dan menawarkan rekomendasi klausul tambahan.

### E. Verifikasi Foto Flowchart terhadap Dokumen BRD (*Visual Flowchart Verification*)
- **Input:** SA mengunggah gambar/foto flowchart (format `.png`, `.jpg`, `.webp`) atau diagram proses bisnis (misal hasil foto papan tulis atau tangkapan layar Miro/Lucidchart).
- **Pemrosesan Gambar & OCR:**
  - Berkas gambar disimpan di Cloudflare R2 via `@anvia/client-s3`.
  - Teks, simpul (*nodes*), percabangan (*decision diamonds*), dan arah panah alur diekstrak menggunakan OCR berbasis `@anvia/mistral` (atau vision model).
- **Pencocokan Alur (Cross-Matching):**
  - Agen membandingkan alur yang terbaca dari flowchart terhadap klausul dalam dokumen BRD yang sedang aktif atau di-`@mention`.
  - **BRD Target:** Job `flowchart-verify` menerima `brdDocumentId` dalam payload; server resolve konten markdown versi aktif untuk komparasi. Jika tidak ada BRD diseleksi, laporan gap tidak digenerate — frontend prompt SA untuk diseleksi BRD aktif pertama.
- **Laporan Verifikasi:**
  - *Matches:* Alur dan logika bisnis yang sudah selaras antara gambar flowchart dan BRD.
  - *Gaps & Inconsistencies:* Langkah/percabangan di flowchart yang belum diatur dalam BRD, atau aturan validasi di BRD yang tidak ada di flowchart.
  - *Rekomendasi Revisi:* Tombol aksi cepat untuk menambahkan alur yang terlewat ke dokumen BRD.

### F. Manajemen Sesi: Histori Sesi, File Upload, dan Riwayat Versi BRD (*Session Lifecycle & Audit Trail*)
Setiap sesi (*session workspace*) bersifat mandiri dan menyimpan rekam jejak lengkap:
- **Histori Percakapan:** Seluruh dialog tanya-jawab dan instruksi disimpan persisten via `@anvia/memory-prisma`.
- **Daftar File yang Pernah Diunggah:** Daftar seluruh dokumen (PDF, MD, gambar flowchart) yang diunggah khusus pada sesi tersebut, lengkap dengan status pemrosesan (Uploading, OCR, Indexed, Ready).
- **Penanda Sesi Aktif di Daftar Percakapan:** Sesi yang sedang dibuka diindikasi jelas (highlight + dot + teks semibold); aksi per-sesi (**rename/hapus** via menu ⋯) **tampil selalu** di setiap row — tidak hanya saat hover (konsisten lintas browser).
- **Histori Perubahan BRD (*Version Control / Snapshot*):**
  - Setiap kali BRD dibuat (v1 auto-create), dimodifikasi oleh AI, atau disimpan manual oleh SA, sistem mencatat versi (*snapshot*) baru (`v1.0`, `v1.1`, dst.).
  - SA dapat melihat *diff* (perubahan) antar-versi serta melakukan *restore/rollback* ke versi draf sebelumnya jika diperlukan.
- **Panel Version History (*UI Layout*):** Bagian layout `BRD_ACTIVE` (§4B.1) — list versi (`v1, v2, …` + badge versi aktif), panel diff antar-versi, dan tombol **Restore/Rollback** ke versi sebelumnya. Versi aktif = yang sedang dipublish di editor markdown; restore = set versi itu sebagai `contentMarkdown` aktif (+ snapshot baru).

### G. Sesi Baru Terisolasi (*Blank Base*) & Referensi Lintas Sesi (*Cross-Session @mention & Copy*)
- **Blank Base by Default:** Ketika membuka sesi baru, ruang kerja dimulai dari kondisi bersih (*fresh slate*) tanpa kontaminasi konteks dari sesi lain, menjamin privasi dan fokus proyek.
- **Cross-Session Mention (`@mention`):**
  - Di kolom input chat, SA dapat mengetik simbol `@` untuk membuka popover pencarian dokumen BRD atau file dari sesi lain (misal `@BRD-Customer-Auth-v1`).
  - **Endpoint Pencarian:** Popover disejuta `GET /search?q=<tekst>&type=brd|document` — server mencari lintas sesi user (excl. sesi aktif) via ILIKE pada `BrdDocument.title` / `Document.title`. (Vektor search Qdrant lintas sesi = enhancement nanti, tidak required v1.)
  - Ketika dokumen dari sesi lain dipilih, sistem menyediakan opsi untuk **mereferensikan** (*read-only context*) atau **menyalin (*copy*)** dokumen tersebut ke dalam sesi aktif saat ini.
  - **Semantik Copy:** Copy BRD = duplikasi `BrdDocument` + seluruh `BrdVersion` (contentMarkdown kopi) dengan `sessionId` baru; copy Document = duplikasi row `Document` + referensi object R2 existing (tidak perlu re-upload biner). Dokumen asli di sesi asal tidak terubah.
  - Dokumen yang disalin dapat langsung dimodifikasi atau dijadikan dasar komparasi tanpa memengaruhi dokumen asli di sesi sebelumnya.

### H. Menu Pengaturan Komprehensif (*Global & Workspace Settings — Modal*)
Pengaturan membuka sebagai **modal dialog** (popup) dari tombol header aplikasi — bukan halaman/route terdedikasi — dan berisi:
1. **Prompt Instruction Customization:** Mengubah atau menambahkan instruksi sistem dasar (misal: "Selalu gunakan Bahasa Indonesia formal", "Sertakan standar keamanan OWASP Top 10 pada setiap NFR").
2. **Theme Configuration:** Pengaturan tema tampilan (Light Mode, Dark Mode, atau System Sync).
3. **AI Provider & Model Info (Read-Only):** Provider LLM aktif beserta model ID (misal `gpt-4o`, `gpt-4o-mini`) **disediakan dan dikelola server** — halaman Settings hanya **menampilkannya sebagai info**; user tidak dapat mengubahnya.
4. **Credential Provider (Server-side, fully managed):** API key AI dan kredensial storage (OpenAI/Mistral/Tavily/Qdrant/R2) disediakan **server-side** via environment variable. User tidak perlu mengisi kredensial apa pun dan tidak ada opsi override per-user di UI. (Kolom `encryptedApiKey` tetap ada di skema untuk kebutuhan admin/server; tidak diekspos ke user.)
5. **Per-Request Agent Build:** `/chat` membaca preferensi user (`theme`, `systemPrompt`, template aktif) **per request** untuk bangun instans agent — tidak singleton global. Provider/model/baseUrl/kredensial selalu resolve dari **env server**; tidak ada override per-user.

---

## 5. Arsitektur Teknis & Spesifikasi Stack

Sistem dibangun menggunakan pendekatan monorepo berbasis `pnpm workspace`:

> **v1 Constraint — Identitas User:** API v1 mengidentifikasi user via header `x-user-id` (fallback `demo-user`); autentikasi proper (login/JWT) setup **sesudah** alur utama jalan. Isolation antar-user tetap diensure sejak awal: semua query filter `userId`, dan payload embedding Qdrant menyertakan `userId`.

```
sa-ai-assistant/
├── packages/
│   └── agent/             # Core Agent Package (Anvia SDK, LLM, Tools, Prompts)
├── apps/
│   ├── api/               # Backend Service & Asynchronous Workers (Hono, BullMQ, Prisma)
│   └── platform/          # Frontend Web App (React 19, shadcn/ui, @anvia/react)
└── docs/                  # Dokumentasi Proyek & Spesifikasi
```

### 5.1. Matriks Library & Stack Teknologi

| Komponen / Modul | Peran / Kebutuhan | Library & Teknologi |
| :--- | :--- | :--- |
| **Core Agent (`packages/agent`)** | Framework agen & alur penalaran | `@anvia/core` (`Agent`, `createTool`, `createCompletion`) |
| | LLM Provider | `@anvia/openai` (GPT-4o / GPT-4o-mini / provider kompatibel) |
| | Prompting & Standard | Instruksi SA + Ekstraktor Template BRD Standar |
| | Eksternal Search | `@tavily/core` |
| **Backend API (`apps/api`)** | HTTP Server & Routing | `hono` v4 + `@hono/node-server` |
| | Streaming Chat Agent | `@anvia/server` (SSE streaming adapter untuk Hono/Web Standards) |
| | AI Completion Engine | `@anvia/core` (`createCompletion` untuk parsing template, klarifikasi singkat, dan summary) |
| | OCR & Vision Dokumen/Flowchart | `@anvia/mistral` (OCR ekstraksi teks & diagram dari PDF serta gambar flowchart) |
| | Text Embedding Engine | `@anvia/transformer` (generasi vektor semantik potongan dokumen) |
| | Vector Database & Adapter | **Qdrant** didukung oleh adapter `@anvia/qdrant` |
| | Cloud Storage Adapter | **Cloudflare R2** via `@anvia/client-s3` (S3-compatible SDK) |
| | Database Relasional & ORM | **PostgreSQL 16** + `prisma` v7 dengan `@prisma/adapter-pg` |
| | Agent Memory & Session | `@anvia/memory-prisma` (persistensi histori percakapan & turn) |
| | Asynchronous Job Queue | **BullMQ** + **ioredis** (antrean pemrosesan OCR, embedding, indeks Qdrant — export PDF sync HTTP, bukan queue) |
| | In-Memory Broker/Cache | **Redis** (Docker / Cloud Instance) |
| **Web Platform (`apps/platform`)** | UI Framework & Bundler | `react` v19 + `vite` v8 + TypeScript |
| | Routing & Navigation | `@tanstack/react-router` (file-based routing) |
| | Styling & Desain Sistem | `tailwindcss` v4 + **shadcn/ui** (komponen dialog, drawer, dropdown, tabs, tooltip) |
| | Headless Chat Agent | `@anvia/react` dan `@anvia/react-ui` (state management percakapan, streaming hook, chat components) |
| | Markdown Editor & Preview | `@uiw/react-md-editor` atau CodeMirror + React Markdown |
| | Icons | `lucide-react` |
| | Visualisasi Diagram | `mermaid` (rendering diagram alur/flowchart di chat dan viewer) |

---

### 5.2. Skema Data & Model Prisma (`apps/api/prisma/schema.prisma`)

Untuk mendukung histori file, template standar, versioning BRD, dan preferensi pengaturan:

```prisma
// Ekstensi Skema Prisma untuk Asisten SA
// Note: model Document + DocumentPage + enum sudah dieksist di kode current (apps/api/prisma/schema.prisma).
// PRD ini = ekstensi (field templateStructure, report, status PENDING_CONFIRMATION) di atas base existing.

model Project {
  id          String    @id @default(cuid())
  name        String
  description String?
  templateId  String?   // Merujuk ke Document template standar default
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sessions    AgentMemorySession[]
  documents   Document[]
}

enum DocumentStatus {
  UPLOADING
  PROCESSING
  READY
  FAILED
  PENDING_CONFIRMATION // Template: hasil ekstraksi siap review SA (Settings → Template) sebelum activeTemplateId disetel
}

enum DocumentFileType {
  PDF
  MARKDOWN
  IMAGE_FLOWCHART
  DOCX
  OTHER
}

model Document {
  id          String         @id @default(cuid())
  userId      String                       // Pemilik dokumen (isolation multi-user via header x-user-id)
  sessionId   String?                      // Null jika dokumen aset global / template perusahaan (isTemplate=true, per-user)
  projectId   String?
  title       String
  fileType    DocumentFileType
  isTemplate  Boolean        @default(false) // true = dokumen template global (upload via Settings), sessionId/projectId null
  storageUrl  String                       // URL file di Cloudflare R2
  objectKey   String         @unique       // Key object R2 (referensi delete/OCR worker)
  fileSize    Int
  status      DocumentStatus @default(UPLOADING) // "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "PENDING_CONFIRMATION"
  ocrResult   String?                      // Hasil teks hasil OCR via @anvia/mistral
  summary     String?                      // Ringkasan dokumen (generasi worker doc-ingestion)
  error       String?                      // Detail error worker (dipoll frontend)
  templateStructure Json?                  // Hasil ekstraksi struktur template (queue template-extract): heading hierarchy, konvensi ID, metadata
  report      Json?                        // Hasil verifikasi flowchart (queue flowchart-verify): matches, gaps, rekomendasi
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  pages       DocumentPage[]
  project     Project?       @relation(fields: [projectId], references: [id])

  @@index([sessionId, userId])
  @@index([projectId])
}

model DocumentPage {
  id         String   @id @default(cuid())
  documentId String
  pageNumber Int
  content    String
  metadata   Json
  createdAt  DateTime @default(now())

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, pageNumber])
  @@index([documentId])
}

model BrdDocument {
  id          String       @id @default(cuid())
  sessionId   String
  title       String
  currentVersion Int       @default(1)
  contentMarkdown String   // Konten Markdown aktif
  status      String       @default("DRAFT") // "DRAFT" | "IN_REVIEW" | "APPROVED"
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  versions    BrdVersion[]
}

model BrdVersion {
  id            String       @id @default(cuid())
  brdDocumentId String
  versionNumber Int
  contentMarkdown String
  changeSummary String?      // Ringkasan perubahan ("Initial draft", "Added FR-003", dll)
  createdBy     String       // "AI_AGENT" | "USER_MANUAL"
  createdAt     DateTime     @default(now())

  brdDocument   BrdDocument  @relation(fields: [brdDocumentId], references: [id], onDelete: Cascade)
}

model UserSetting {
  id              String   @id @default(cuid())
  userId          String   @unique
  theme           String   @default("system") // "light" | "dark" | "system"
  aiProvider      String   @default("openai") // Server-managed, read-only di UI (tidak bisa diubah user)
  aiModel         String   @default("gpt-4o") // Server-managed, read-only di UI
  customBaseUrl   String? // Server-managed, read-only di UI
  encryptedApiKey String? // Tidak diekspos ke user; hanya untuk kebutuhan admin/server (AES-256-GCM, key env secret)
  systemPrompt    String?  // Custom system prompt override
  activeTemplateId String? // Template global aktif per-user (Document.id where isTemplate=true, sessionId=null)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

### 5.3. Arsitektur Background Worker (*Multi-Queue BullMQ*)

Pemisahan task berat dalam **3 queue BullMQ terpisah** (satu Redis connection, worker process independen per queue supaya diskalabel per-kebutuhan):

| Queue | Handler | Cargo | Config |
| :--- | :--- | :--- | :--- |
| `doc-ingestion` | **Ekstraksi teks:** DOCX via mammoth/pandoc → OCR `@anvia/mistral` (PDF/image) → `DocumentPage` + summary → embed `@anvia/transformer` → index Qdrant | BRD/PDF/MD/DOCX existing (upload di sesi) | `concurrency: 2`, `attempts: 3`, backoff eksponensial |
| `template-extract` | Baca `DocumentPage` dari hasil `doc-ingestion` → `createCompletion` via `@anvia/core` → parse struktur template (heading, konvensi ID, metadata) → simpan `templateStructure` → status `PENDING_CONFIRMATION` | Dokumen standar upload via **Settings → Template** | `concurrency: 4`, `attempts: 1` |
| `flowchart-verify` | Vision OCR nodes/arrows → cross-match vs **BRD aktif** (`brdDocumentId` dalam payload) → simpan `report` (matches/gaps/rekomendasi) | Foto flowchart upload | `concurrency: 4`, `attempts: 2`, **priority tinggi** (respons interaktif) |

**Pola & best practices:**
- **Payload job ringan:** queue hanya menerima `{ documentId, objectKey }` (+ `brdDocumentId` untuk flowchart); worker ambil file dari R2 dan metadata dari PostgreSQL — tidak pernah transit file biner via Redis.
- **Status lifecycle dokumen:** setiap job set `PROCESSING` di awal dan `READY` / `FAILED` (+ `error`) di akhir; template job ending di `PENDING_CONFIRMATION`. Frontend poll status via `GET /documents/:id`.
- **Verifikasi flowchart interaktif:** job `flowchart-verify` diberi priority tinggi agar tidak antri di belakang job OCR besar; laporan `report` disimpan di `Document` untuk dipoll frontend.
- **Worker terpisah & diskalabel:** setiap queue bisa diskalakan independen (mis. naikkan concurrency `flowchart-verify` tanpa memengaruhi ingestion).
- **Isolation Konteks Qdrant:** payload embedding menyertakan `{ documentId, userId, sessionId, pageNumber }` (tidak hanya `documentId`). Search/retrieval agent **mest filter `userId`** (dan `sessionId` untuk sesi aktif) supaya sesi terisolasi per §G — penyesuaian @mention lintas sesi hanya dengan aksi eksplisit user (search endpoint §G).
- **Pipeline Template:** upload template → `doc-ingestion` (ekstraksi teks) → `template-extract` → `PENDING_CONFIRMATION` → SA **approve/reject** di Settings → Template → set `activeTemplateId`. Ekstraksi LLM heuristic — tidak pernah auto-apply tanpa konfirmasi SA.
- **DOCX:** Mistral OCR tidak parse `.docx`; pipeline `doc-ingestion` mest ekstrak teks DOCX (mammoth/pandoc) sebelum chunking/embedding. Markdown set `READY` langsung tanpa OCR.

---

### 5.4. Katalog Tool Core Agent (*Proper, Grounded, Abuse-Safe*)

Tools eksisting saat ini (`packages/agent/src/tools/`) masih **stub**: hanya pass-through data dengan `status: "ready_for_model_completion"` dan belum wiring grounding/retrieval/template. Target v1 = tool contract komplett, zod-validated, setiap tool memiliki **grounding source**, **abuse guard**, dan **cost guard**:

| Tool | Fungsi | Grounding Source | Abuse Guard | Cost Guard |
| :--- | :--- | :--- | :--- | :--- |
| `search_context` | **NEW** — Semantic retrieval dokumen acuan | Qdrant — filter `{ userId, sessionId }` (server-side, bukan prompt-only) | Enforce filter di implementation, bukan hanya prompt; @mention lintas sesi hanya via endpoint eksplisit | Top-k default `5`, chunk limit, tanpa LLM |
| `get_template_structure` | **NEW** — Resolve template per precedence (§4A: session → project → global → builtin) | `Document.templateStructure` + `UserSetting.activeTemplateId` + `AgentMemorySession.metadata.templateId` | Template belum `READY`/approve → return builtin + note | Baca DB langsung, tanpa LLM |
| `get_active_brd` | **NEW** — Fetch `BrdDocument.contentMarkdown` versi aktif + list versi | `BrdDocument` / `BrdVersion` | Access check `userId`+`sessionId`; hanya BRD yang diseleksi user | Baca DB langsung, tanpa LLM |
| `elicit_clarifications` | **NEW** — Output **deterministic** batch `clarification_questions` JSON (zod: `{id, question, options[], required}`) per §4B | Kontekst User Story + jawaban round sebelumnya | Max 2 round × 2–3 Q/round (loop guard enforced di tool impl, bukan prompt) | Model easy/medium (CLARIFY phase §5.5) |
| `draft_brd` | **REWRITE** — Input `{userStory, clarifications[], templateStructure, referenceContext}` → full markdown + `assumptions[]` + traceability map | `search_context` hasil + `get_template_structure` | Draft hanya dieksekusi setelah **clarification gate** §5.5 (sufficient/cap) | Model hard; context distilled §5.5 |
| `modify_brd` | **REWRITE** — `{brdId, changeRequest, referenceContext}` → updated markdown + `changeSummary` + affected `FR/BR` IDs | `get_active_brd` + `search_context` | Delta update tidak auto-persist — snapshot selalu via aksi manusia (§4C) | Model medium; hanya delta/affected section |
| `answer_brd_question` | **REWRITE** — Grounded Q&A → `{answer, citations[]}`; no evidence → `{answer: null, gaps[]}` (no hallucination) | `get_active_brd` (single source of truth) | Jawaban mest citasi section/`FR-ID`; tidak invent batas | Model medium; tanpa context search jika BRD selaras |
| `verify_flowchart` | **REWRITE** — `{flowchartDocumentId, brdDocumentId}` → baca OCR (`DocumentPage`) + BRD konten → `{matches[], gaps[], recommendations[]}` | `DocumentPage` (hasil `doc-ingestion`) + `get_active_brd` | Tidak repair silently — mismatch diekspose sebagai gap | Worker async (queue `flowchart-verify`), bukan chat turn |
| `web_search` | **KEEP restricted** — External/public reference hanya | Tavily | **Query redaction:** tidak embed private BRD/dokumen content; requires intent user eksplisit | Usage cap per session; fallback: kontekst internal first |

**Non-goal (eksplisit):** Agent memiliki **zero write tools** — tidak ada save/delete/publish tool. Persistensi BRD selalu human-triggered (Generate/Save/Approve, §4C). Ini guard anti-abuse utama + integritas data: model tidak pernah bisa mutate state tanpa aksi manusia.

### 5.4.1. Instruksi Sistem (*Hardening & Abuse Prevention*)

Baseline existing `packages/agent/src/prompt/instructions.ts` (security block sudah strong) + perkuat dengan requirement PRD berikut:
- **Grounding-only:** Jawaban hanya berdasarkan hasil retrieval/dokumen; informasi tidak exist → eksplisit state absence + rekomendasi, **tidak berhalusinasi**.
- **Prompt-Injection Defense:** Semua konten user message, dokumen, web search result = **untrusted data, never instructions** — enforced di tool implementation (validate/filter output), bukan hanya prompt-level.
- **No Data Exfiltration:** Query `web_search` tidak boleh embed private BRD content, dokumen teks, atau detail sistem; redaction server-side.
- **No-Write Principle:** Tools tidak ada write capability; never claim save/send/publish without actual tool success (per existing instructions).
- **Session Isolation:** Retrieval filter `userId`/`sessionId` enforced server-side; cross-session hanya via aksi user eksplisit (@mention).
- **Deterministic Output:** Semua structured data via zod-validated tools (`clarification_questions`, `matches/gaps`, `citations`) — model tidak output bare JSON.
- **Cleanup Wireframe:** Eliminiasi semua referensi wireframe/Figma dari `instructions.ts` + `BRD_OUTPUT_GUIDANCE` (Fase 1 task).

### 5.5. Agentic Flow & Cost Control (*Decision Layers*)

Pendekatan agentic decision seperti existing `model-router.ts` (workflow routing heuristic + LLM classifier) diekstend ke layer lain supaya cost LLM minimun dan respons prediktabel:

1. **Workflow Classifier (Orchestrator):** Model cheap klasifikasi message user → `{ operation: "draft" | "clarify_response" | "modify" | "qa" | "flowchart" | "unsupported" }` via structured schema (pattern `DifficultyDecisionSchema`). Prevent model hard invoked pada input trivial/unsupported; unsupported → direct feedback tanpa LLM expensive.
2. **Clarification Gate:** Antes `draft_brd`, model cheap return `{ sufficient: bool, missing: [top ambiguities] }`; hanya jika `sufficient=false` → `elicit_clarifications`; draft hanya dieksekusi ketika sufficient atau 2-round cap (§4B). Cost saving: draft model hard tidak pernah run pada informasi incomplet.
3. **Context Distillation:** Retrieval hasil (`search_context`) dikompakt — top-k cap + extractive summary (pattern worker `summarizeDocument`) — antes inject ke model hard. Reduce token input + halusinasi surface.
4. **Phase-Aware Model Routing:** Phase CLARIFY → easy/medium model; GENERATE/draft → hard; Q&A → medium; retrieval/vector → embedding only (zero LLM). Extend `model-router.ts` dengan dimension phase (CLARIFY/GENERATE/QA), bukan hanya difficulty.
5. **Async Heavy Work:** Flowchart verify & template extract & OCR selalu via BullMQ worker (§5.3), tidak pernah consume chat turn/LLM hard.

---

## 6. Alur Kerja Pengguna Terintegrasi (*End-to-End User Journeys*)

### 6.1. Alur Penyusunan BRD dengan Klarifikasi AI & Template Standar
```
[1. Sesi Baru → State EMPTY_SESSION: Panel "New BRD" (textarea User Story + upload acuan opsional + tombol Generate)]
                      │
                      ▼
[2. (Opsional) Upload Dokumen BRD Standar via Settings → Template → template-extract → SA Konfirmasi → activeTemplateId]
                      │
                      ▼
[3. Klik "Generate BRD" → State CLARIFYING: AI Deteksi Ambiguitas → Output Clarification Questions (batch JSON)]
                      │
                      ▼
[4. Feedback Form: SA Menjawab Options / "isi sendiri" → Submit (Round 1)]
                      │ (Jika ambiguitas masih ada: Round 2 form, max 2 round)
                      ▼
[5. State GENERATING: AI Menggabungkan User Story + Jawaban + Konteks → Stream Draf BRD Sesuai Template]
                      │
                      ▼
[6. Auto-Create BrdDocument v1 (POST /brd) → Editor Markdown Populate → Version History mulai v1]
                      │
                      ▼
[7. State BRD_ACTIVE: Layout = Chat Agent + Markdown Editor + Version History Panel]
                      │
                      ├── Edit Langsung di Form Markdown → Save Version (BrdVersion v2, v3, …)
                      ├── Modifikasi dengan Perintah AI di Chat (Delta Update → Approve → Snapshot)
                      ├── View Diff antar-versi / Restore/Rollback
                      └── Ekspor ke Markdown (.md) atau PDF (.pdf)
```

### 6.2. Alur Verifikasi Foto Flowchart terhadap BRD
```
[1. SA Mengunggah Foto/Gambar Flowchart (.png/.jpg)]
                      │
                      ▼
[2. Simpan ke Cloudflare R2 via @anvia/client-s3 + enqueue job flowchart-verify]
                      │
                      ▼
[3. Worker flowchart-verify (async, priority tinggi): OCR Nodes/Teks via @anvia/mistral]
                      │
                      ▼
[4. Komparasi Alur Flowchart vs Klausul BRD Aktif]
                      │
                      ▼
[5. Frontend Polling Status → Tampilan Laporan Verifikasi: Matches, Gaps, & Rekomendasi]
                      │
                      ▼
[6. SA Menyetujui Rekomendasi ──► Auto-Update Konten BRD]
```

### 6.3. Alur Referensi Lintas Sesi (@mention)
```
[SA Membuka Sesi Baru (Blank Base)]
                 │
                 ▼
[SA Mengetik "@" pada Input Chat]
                 │
                 ▼
[Muncul Popover Daftar Dokumen/BRD dari Seluruh Sesi]
                 │
                 ▼
[Pilih: "@BRD-Auth-v1" ──► Pilih Aksi: Copy ke Sesi Ini]
                 │
                 ▼
[Dokumen Disalin ke Sesi Aktif Sebagai Referensi/Draf Baru]
```

---

## 7. Rencana Tahapan Pengembangan (*Roadmap & Milestones*)

**MVP 7 hari end-to-end** — detail task per day → §10. Day 7 = **hard stop testing/evals** (no new features).

- **Day 1** — Core Agent, Dynamic Template, Tools & Agentic Flow
- **Day 2** — Worker Multi-Queue & Ingestion Pipeline
- **Day 3** — Data Model & API Modules (`/brd`, `/chat`, `/document`, `/search`)
- **Day 4** — Settings & Template Global (`/settings`, `/settings/template`)
- **Day 5** — Platform: Editor, Version History, Settings & @mention
- **Day 6** — Flowchart Stretch & Integrasi End-to-End + Perf Tests
- **Day 7** — Testing & Evals (*hard stop*, no new features)

---

## 8. Metrik Keberhasilan (*Success Metrics*)

| Metrik | Target Kuantitatif / Kualitatif | Metode Pengukuran |
| :--- | :--- | :--- |
| **Efisiensi Waktu Penyusunan** | Pengurangan waktu pembuatan draf awal BRD hingga $\ge 70\%$ dibandingkan cara manual. | Perbandingan waktu pencatatan SA sebelum dan sesudah menggunakan sistem. |
| **Kepatuhan Format Standar** | $100\%$ dokumen BRD yang dihasilkan mengikuti struktur template standar yang diunggah. | Audit otomatis struktur bab dan penomoran ID kebutuhan. |
| **Akurasi Verifikasi Flowchart** | Mampu mendeteksi $\ge 90\%$ ketidaksesuaian/kesenjangan logika antara foto flowchart dan aturan BRD. | Uji kasus uji *benchmark* (*gap detection test suite*). |
| **Presisi Jawaban Dokumen (Q&A)** | Nilai halusinasi $< 5\%$; jawaban selalu merujuk pada klausa BRD atau dokumen acuan. | Evaluasi sampling acak terhadap respons Q&A berbasis fakta. |
| **Keberhasilan Lintas Sesi** | Pemanfaatan dokumen sesi lama melalui `@mention` berhasil diambil/disalin tanpa distorsi sebesar $100\%$. | Automated testing untuk *cross-session copy & retrieval*. |
| **Kepuasan Pengguna (SA)** | Skor kepuasan $\ge 4.5/5.0$ terkait kemudahan editor Markdown, alur klarifikasi, dan ekspor PDF. | Kuesioner evaluasi uji coba pengguna (*User Acceptance Test*). |

---

## 9. Prinsip Desain Produk (*Product Principles*)

1. **Human-in-the-Loop & Total Editorial Control:** AI bertindak sebagai perancang draf dan verifikator; System Analyst memegang kendali penuh melalui editor Markdown dan persetujuan akhir dokumen.
2. **Proactive Elicitation (No Silent Assumptions):** AI tidak boleh menebak aturan bisnis yang belum pasti. Hal yang ambigu wajib diklarifikasi secara proaktif sebelum draf difinalisasi.
3. **Traceability & Grounding:** Setiap poin spesifikasi fungsional dan teknis harus memiliki asal-usul yang jelas (*source of truth*), baik dari User Story, dokumen acuan internal, maupun gambar flowchart.
4. **Clean Boundaries & Modularity:** Pemisahan tegas antara penalaran agen (`packages/agent`), background pipeline & persistensi data (`apps/api`), dan pengalaman interaksi pengguna (`apps/platform`).
5. **Deterministic Over Decorative:** Mengutamakan ketepatan definisi teknis, kestabilan format ID (`BR-xxx`, `FR-xxx`), dan kepatuhan standar dibandingkan narasi kreatif atau estetika yang tidak perlu.

---

## 10. Rencana Eksekusi MVP — 7 Hari (*Target: MVP Jalan End-to-End*)

**Target 7 hari:** sistem harus bisa jalan alur lengkap dari upload template standar → user story → klarifikasi AI → draf BRD sesuai template → edit di editor → ekspor Markdown/PDF. Rencana: **Day 1-5 build** → **Day 6 integrasi/stretch** → **Day 7 testing & evals (hard stop, no new features)**. (Flowchart verification menjadi *stretch goal* jika semua core alur sudah jalan.)

### Day 1 — Core Agent: Template Dynamic, Tools & Klarifikasi
- [x] Evaluasi kode dasar `packages/agent`.
- [ ] Refactor `packages/agent/src/prompt/instructions.ts` + `BRD_OUTPUT_GUIDANCE` — eliminiasi referensi wireframe/Figma (tool sudah dihapus, focus pada teks prompt); perkuat instruksi template adoption, clarification loop, grounding-only, prompt-injection defense, no-exfiltration (§5.4.1).
- [ ] Implementasi **template extraction** via `createCompletion` (`@anvia/core`): parse hierarki heading, bagian wajib, konvensi ID (`BR-XXX`/`REQ-XXX`).
- [ ] Implementasi **tool catalog §5.4**: `search_context`, `get_template_structure`, `get_active_brd`, `elicit_clarifications` (NEW) + rewrite `draftBrdTool`/`modifyBrdTool`/`answerBrdQuestionTool`/`verifyFlowchartTool`.
- [ ] Implementasi **agentic flow §5.5**: Workflow Classifier + Clarification Gate + Context Distillation + Phase-Aware Model Routing.
- [ ] Perkuat `draftBrdTool` — menerima struktur template dinamis hasil upload dokumen standar.
- [ ] Implementasi **clarification elicitation loop** (proactive) sebelum draf final — output structured `clarification_questions` batch + **max 2 rounds** per §4B.
- [ ] API `/chat` two-phase (CLARIFY / GENERATE) untuk feedback form flow.
- [ ] Testing skenario penyusunan via `runner.dev.ts`.

### Day 2 — Worker Multi-Queue & Ingestion Pipeline
- [ ] Refactor `apps/api/src/lib/queue.ts` → 3 named queue BullMQ (`doc-ingestion`, `template-extract`, `flowchart-verify`) + shared redis connection.
- [ ] Pisahkan handler worker: `process-document.ts` (ingestion, + ekstraksi DOCX mammoth/pandoc, embedding payload `userId`+`sessionId`), baru `extract-template.ts`, baru `verify-flowchart.ts`.
- [ ] Update `apps/api/src/worker/index.ts` → 3 worker terpisah (concurrency/retry/priority per queue, §5.3).
- [ ] Aktifkan kembali enqueue di `apps/api/src/modules/document/router.ts` dengan routing by jenis file/operasi (+ `brdDocumentId` untuk flowchart).
- [ ] Konfigurasi upload berkas ke Cloudflare R2 menggunakan `@anvia/client-s3` (+ `R2_PUBLIC_BASE_URL` untuk OCR worker).
- [ ] Setup Docker Compose dev (PostgreSQL, Redis, Qdrant) + migrasi database.
- [ ] Adapter retrieval Qdrant agent: **filter `userId`/`sessionId`** pada search (isolation §G).

### Day 3 — Prisma Schema & `/brd` Module
- [ ] Update `schema.prisma`: model `BrdDocument`, `BrdVersion`, `Project`, `UserSetting` (+ extend `Document`: `templateStructure Json?`, `report Json?`, status `PENDING_CONFIRMATION`).
- [ ] Jalankan migrasi (`prisma migrate dev`) + `prisma generate`.
- [ ] Modul API `/chat`: streaming SSE `@anvia/server` + persistensi sesi `@anvia/memory-prisma` + **agent build per-request** (preferensi user: theme/customPrompt/template; provider/model/kredensial selalu dari env server, tanpa override per-user).
- [ ] Modul API `/document`: upload berkas + routing queue sesuai jenis (ingestion / template-extract / flowchart-verify) + status worker + `GET /documents/:id` hasil verifikasi.
- [ ] Modul API `/brd`: CRUD BRD, simpan versi (*snapshot* via save flow frontend §C), diff versi, restore/rollback.
- [ ] Endpoint ekspor Markdown (`.md`) + **ekspor PDF sync HTTP**.
- [ ] Endpoint `/search` — pencarian lintas sesi (`?q=&type=brd|document`) untuk popover `@mention`.

### Day 4 — `/settings` & Template Global
- [ ] Modul API `/settings`: get/update theme & custom prompt (provider/model/kredensial read-only, server-managed; tanpa override per-user di UI).
- [ ] Endpoint `/settings/template`: upload dokumen standar sebagai template global per-user → `template-extract` → status `PENDING_CONFIRMATION` → endpoint **approve/reject** → set `activeTemplateId`.
- [ ] Endpoint `GET /documents/:id` — hasil `templateStructure` / `report` untuk polling frontend.
- [ ] Verify status lifecycle dokumen (`UPLOADING → PROCESSING → READY/FAILED`; template: `→ PENDING_CONFIRMATION → READY/FAILED`) end-to-end.

### Day 5 — Platform: Split Editor, Export & Settings
- [ ] Inisialisasi dan konfigurasi pustaka komponen **shadcn/ui** di `apps/platform`.
- [ ] Integrasikan `@anvia/react` dan `@anvia/react-ui` untuk penanganan streaming chat dan interaksi percakapan.
- [ ] Bangun layout utama aplikasi:
  - **Empty State (`EMPTY_SESSION`):** Panel "New BRD" — textarea User Story + upload dokumen acuan opsional + tombol **Generate BRD** (state machine §4B.1).
  - **Feedback Form (`CLARIFYING`):** Render `clarification_questions` JSON → radio/checkbox options + input "isi sendiri" + tombol Submit (iteratif rounds).
  - Sidebar: navigasi sesi + **penanda sesi aktif** (highlight/dot), aksi rename/hapus **tampil selalu** per sesi, status storage, tombol *New Chat*, daftar dokumen sesi aktif.
  - Chat Pane: interaksi percakapan, streaming draft BRD, rendering bubble pesan.
  - Document Pane (*Split View*): Editor Markdown interaktif (`@uiw/react-md-editor`), live preview, tombol save version, dan tombol ekspor Markdown & PDF.
  - **Version History Panel (`BRD_ACTIVE`):** list versi (`v1, v2, …` + badge versi aktif), panel diff antar-versi, tombol Restore/Rollback.
- [ ] Halaman root `/` = **landing page** (pengenalan fitur + tata cara), CTA ke workspace; ruang kerja di route `/workspace`.
- [ ] Implementasikan popover autocomplete `@mention` untuk mencari dan menyalin dokumen lintas sesi.
- [ ] Implementasi upload foto flowchart dengan tombol verifikasi instan.
- [ ] Integrasi **split-pane markdown editor** (`@uiw/react-md-editor`) dengan live preview + edit manual.
- [ ] Tombol **Save Version** (snapshot `BrdVersion`) + diff view.
- [ ] Ekspor Markdown & PDF dari editor.
- [ ] Modal **Settings** (popup, bukan halaman): theme + custom prompt (editable), info AI provider/model/kredensial (read-only), **section Template upload** + status (`PENDING_CONFIRMATION` → tombol Approve/Reject). *(Provider/model/kredensial AI/storage disediakan & dikelola server-side; user tidak dapat mengubahnya.)*

### Day 6 — Flowchart Verify UI & Validasi E2E
- [ ] (Stretch) Frontend flow verifikasi flowchart: upload foto → poll status → render laporan `report` (matches/gaps/rekomendasi) → tombol auto-update BRD.
- [ ] Uji skenario lengkap end-to-end: upload template → user story (panel "New BRD") → feedback form klarifikasi → draf stream → auto-create v1 → edit/save versi → ekspor.
- [ ] Uji ketahanan memori agen (multi-turn conversation) dan *rollback* riwayat versi BRD.
- [ ] Uji performa pipeline OCR `@anvia/mistral` dan embedding `@anvia/transformer`.
- [ ] Linting (`oxlint`), formatting (`oxfmt`), typecheck (`tsc`) seluruh monorepo.
- [ ] Smoke test API + platform (chat streaming, dokumen, settings, brd).

### Day 7 — Testing & Evals (*Hard Stop*)
- [ ] **Eval harness** per §8 Metrik Keberhasilan:
  - Kepatuhan Format Standar = 100% (audit struktur bab + penomoran ID).
  - Presisi Jawaban (Q&A) halusinasi < 5% (evaluasi sampling acak berbasis fakta).
  - Akurasi Verifikasi Flowchart gap-detection ≥ 90% (benchmark test suite).
  - Keberhasilan Lintas Sesi @mention copy/retrieval = 100% (automated test).
  - Cost LLM per session tracking (efisiensi workflow classifier §5.5).
- [ ] UAT feedback SA (kemudahan editor, alur klarifikasi, ekspor PDF) → fix **blocking-severity only**.
- [ ] Regression E2E final + smoke test API & platform.
- [ ] Pembersihan kode, linting (`oxlint`), formatting (`oxfmt`), typecheck (`tsc`) seluruh monorepo.
