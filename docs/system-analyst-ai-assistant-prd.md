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
- **Ekstraksi Struktur:** Worker mengekstrak dan menganalisis hierarki judul, bagian wajib, konvensi penomoran (misal `BR-XXX`, `REQ-XXX`), dan metadata dari dokumen standar tersebut.
- **Pemberlakuan Template:** Format yang diekstrak dapat disetel sebagai template aktif (baik di tingkat global, proyek, atau per sesi). Core Agent secara otomatis mengadopsi struktur tersebut saat menyusun draf BRD baru sehingga hasil draf selalu konsisten dengan standar perusahaan tanpa perlu penyesuaian manual berulang.

### B. Penyusunan BRD Berbasis User Story dengan Klarifikasi Proaktif (*Conversational Elicitation*)
- **Input Awal:** User memasukkan User Story mentah, *brief* singkat, atau catatan *stakeholder*.
- **Pemberian Umpan Balik & Pertanyaan Pendalaman (*Clarification Loop*):**
  - Agen tidak langsung membuat draf asumtif jika informasi bisnis belum lengkap.
  - Agen secara cerdas mendeteksi ambiguitas (misal: aturan otorisasi belum jelas, batas transaksi tidak terdefinisi, ketiadaan penanganan skenario gagal/timeout) dan merespons dengan **pertanyaan klarifikasi terfokus** kepada SA.
  - SA dapat menjawab pertanyaan klarifikasi secara bertahap dalam thread percakapan.
- **Generasi Draf Final:** Setelah informasi mencukupi, agen menggabungkan User Story awal, jawaban klarifikasi, dan konteks dokumen acuan menjadi dokumen BRD lengkap sesuai format standar yang dipilih.

### C. Editor Markdown Interaktif & Ekspor Multi-Format (Markdown & PDF)
- **Editor Markdown Interaktif:**
  - BRD yang baru digenerate oleh AI langsung ditampilkan pada panel samping (*split-pane editor*) dalam format Markdown terstruktur.
  - SA dapat melakukan pengeditan langsung (*direct manual edit*) melalui form/editor Markdown (dengan *live preview* sintaks tabel, checklist, callout, dan headings).
- **Modifikasi Berbasis Perintah AI (*AI-Assisted Modification*):**
  - Selain edit manual, SA tetap dapat meminta AI merevisi bagian tertentu (misal: "Tambahkan skenario limit 3x percobaan login pada FR-002"). AI akan menghasilkan *delta update* yang secara otomatis diperbarui di editor markdown.
- **Ekspor Dokumen:**
  - **Ekspor Markdown (`.md`):** Mengunduh berkas markdown murni yang siap disimpan ke repositori Git / knowledge base (GitBook/Notion).
  - **Ekspor PDF (`.pdf`):** Mengunduh dokumen yang dirender rapi dengan stylesheet profesional (nomor halaman, kop dokumen, tabel terformat, dan penomoran bab otomatis).

### D. Tanya Jawab Cerdas Berdasarkan BRD Aktif (*Interactive BRD Q&A*)
- SA dapat menanyakan pertanyaan teknis spesifik seputar isi dokumen BRD yang sedang aktif atau dipilih (misal: *"Bagaimana alur kompensasi jika payment gateway timeout di FR-004?"*).
- Jawaban diberikan secara ketat (*grounded*) berdasarkan dokumen BRD tersebut. Jika informasi tidak ada di dokumen, AI tidak berhalusinasi, melainkan menyatakan secara eksplisit bahwa hal tersebut belum diatur dan menawarkan rekomendasi klausul tambahan.

### E. Verifikasi Foto Flowchart terhadap Dokumen BRD (*Visual Flowchart Verification*)
- **Input:** SA mengunggah gambar/foto flowchart (format `.png`, `.jpg`, `.webp`) atau diagram proses bisnis (misal hasil foto papan tulis atau tangkapan layar Miro/Lucidchart).
- **Pemrosesan Gambar & OCR:**
  - Berkas gambar disimpan di Cloudflare R2 via `@anvia/client-s3`.
  - Teks, simpul (*nodes*), percabangan (*decision diamonds*), dan arah panah alur diekstrak menggunakan OCR berbasis `@anvia/mistral` (atau vision model).
- **Pencocokan Alur (Cross-Matching):**
  - Agen membandingkan alur yang terbaca dari flowchart terhadap klausul dalam dokumen BRD yang sedang aktif atau di-`@mention`.
- **Laporan Verifikasi:**
  - *Matches:* Alur dan logika bisnis yang sudah selaras antara gambar flowchart dan BRD.
  - *Gaps & Inconsistencies:* Langkah/percabangan di flowchart yang belum diatur dalam BRD, atau aturan validasi di BRD yang tidak ada di flowchart.
  - *Rekomendasi Revisi:* Tombol aksi cepat untuk menambahkan alur yang terlewat ke dokumen BRD.

### F. Manajemen Sesi: Histori Sesi, File Upload, dan Riwayat Versi BRD (*Session Lifecycle & Audit Trail*)
Setiap sesi (*session workspace*) bersifat mandiri dan menyimpan rekam jejak lengkap:
- **Histori Percakapan:** Seluruh dialog tanya-jawab dan instruksi disimpan persisten via `@anvia/memory-prisma`.
- **Daftar File yang Pernah Diunggah:** Daftar seluruh dokumen (PDF, MD, gambar flowchart) yang diunggah khusus pada sesi tersebut, lengkap dengan status pemrosesan (Uploading, OCR, Indexed, Ready).
- **Histori Perubahan BRD (*Version Control / Snapshot*):**
  - Setiap kali BRD dibuat, dimodifikasi oleh AI, atau disimpan manual oleh SA, sistem mencatat versi (*snapshot*) baru (`v1.0`, `v1.1`, dst.).
  - SA dapat melihat *diff* (perubahan) antar-versi serta melakukan *restore/rollback* ke versi draf sebelumnya jika diperlukan.

### G. Sesi Baru Terisolasi (*Blank Base*) & Referensi Lintas Sesi (*Cross-Session @mention & Copy*)
- **Blank Base by Default:** Ketika membuka sesi baru, ruang kerja dimulai dari kondisi bersih (*fresh slate*) tanpa kontaminasi konteks dari sesi lain, menjamin privasi dan fokus proyek.
- **Cross-Session Mention (`@mention`):**
  - Di kolom input chat, SA dapat mengetik simbol `@` untuk membuka popover pencarian dokumen BRD atau file dari sesi lain (misal `@BRD-Customer-Auth-v1`).
  - Ketika dokumen dari sesi lain dipilih, sistem menyediakan opsi untuk **mereferensikan** (*read-only context*) atau **menyalin (*copy*)** dokumen tersebut ke dalam sesi aktif saat ini.
  - Dokumen yang disalin dapat langsung dimodifikasi atau dijadikan dasar komparasi tanpa memengaruhi dokumen asli di sesi sebelumnya.

### H. Menu Pengaturan Komprehensif (*Global & Workspace Settings*)
Halaman pengaturan terdedikasi bagi SA/Admin untuk mengatur preferensi lingkungan kerja:
1. **Prompt Instruction Customization:** Mengubah atau menambahkan instruksi sistem dasar (misal: "Selalu gunakan Bahasa Indonesia formal", "Sertakan standar keamanan OWASP Top 10 pada setiap NFR").
2. **Theme Configuration:** Pengaturan tema tampilan (Light Mode, Dark Mode, atau System Sync).
3. **AI Provider & Model Selection:** Memilih provider LLM aktif (OpenAI, Azure OpenAI, Mistral, Ollama/Local, Anthropic) serta menentukan model ID (misal `gpt-4o`, `gpt-4o-mini`, `mistral-large`).
4. **API Key & Endpoint Management:** Mengonfigurasi API Key kustom dan Base URL untuk OpenAI, Mistral, Tavily, dan Qdrant secara aman (tersimpan terenkripsi di database atau local storage per-user).

---

## 5. Arsitektur Teknis & Spesifikasi Stack

Sistem dibangun menggunakan pendekatan monorepo berbasis `pnpm workspace`:

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
| | Database Relasional & ORM | **PostgreSQL 17** + `prisma` v7 dengan `@prisma/adapter-pg` |
| | Agent Memory & Session | `@anvia/memory-prisma` (persistensi histori percakapan & turn) |
| | Asynchronous Job Queue | **BullMQ** + **ioredis** (antrean pemrosesan OCR, embedding, indeks Qdrant, & export PDF) |
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

model Document {
  id          String       @id @default(cuid())
  projectId   String?
  sessionId   String?      // Null jika dokumen aset global / template perusahaan
  title       String
  fileType    String       // "PDF" | "MARKDOWN" | "IMAGE_FLOWCHART" | "DOCX"
  isTemplate  Boolean      @default(false)
  storageUrl  String       // URL file di Cloudflare R2
  fileSize    Int
  status      String       // "UPLOADING" | "PROCESSING" | "READY" | "FAILED"
  ocrResult   String?      // Hasil teks hasil OCR via @anvia/mistral
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  project     Project?     @relation(fields: [projectId], references: [id])
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
  aiProvider      String   @default("openai") // "openai" | "azure" | "mistral" | "ollama"
  aiModel         String   @default("gpt-4o")
  customBaseUrl   String?
  encryptedApiKey String?
  systemPrompt    String?  // Custom system prompt override
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 6. Alur Kerja Pengguna Terintegrasi (*End-to-End User Journeys*)

### 6.1. Alur Penyusunan BRD dengan Klarifikasi AI & Template Standar
```
[1. User Upload Dokumen Standar BRD (Opsional)]
                      │
                      ▼
[2. Sistem Menganalisis Template & Struktur Acuan]
                      │
                      ▼
[3. User Memasukkan User Story di Sesi Baru]
                      │
                      ▼
[4. AI Menganalisis Kebutuhan & Menemukan Ambiguitas]
                      │
                      ▼
[5. AI Memberikan Pertanyaan Klarifikasi Terfokus (Loop)]
                      │ (User Menjawab Klarifikasi)
                      ▼
[6. AI Menghasilkan Draf BRD Sesuai Template Standar]
                      │
                      ▼
[7. BRD Terbuka di Split-Pane Markdown Editor]
                      │
                      ├── Edit Langsung di Form Markdown
                      ├── Modifikasi dengan Perintah AI (Delta Update)
                      └── Simpan Versi Baru (BrdVersion Snapshot)
                      │
                      ▼
[8. Ekspor ke Markdown (.md) atau PDF (.pdf)]
```

### 6.2. Alur Verifikasi Foto Flowchart terhadap BRD
```
[1. SA Mengunggah Foto/Gambar Flowchart (.png/.jpg)]
                      │
                      ▼
[2. Simpan ke Cloudflare R2 via @anvia/client-s3]
                      │
                      ▼
[3. Ekstraksi Logika Simpul & Teks via @anvia/mistral OCR]
                      │
                      ▼
[4. Komparasi Alur Flowchart vs Klausul BRD Aktif]
                      │
                      ▼
[5. Tampilan Laporan Verifikasi: Matches, Gaps, & Rekomendasi]
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

### Fase 1: Core Agent, Dynamic Template & Refinement Tools (Minggu 1)
- [x] Evaluasi kode dasar `packages/agent`.
- [ ] Refactor instruksi sistem (`instructions.ts`) untuk sepenuhnya mengeliminasi referensi wireframe/Figma.
- [ ] Hapus tool `createWireframeSpecificationTool` dan perbarui ekspor `packages/agent/src/tools/index.ts`.
- [ ] Implementasikan alur klarifikasi proaktif (*clarification elicitation loop*) sebelum eksekusi final `draftBrdTool`.
- [ ] Perkuat `draftBrdTool` agar dapat menerima struktur template dinamis hasil upload dokumen standar.
- [ ] Implementasikan `createCompletion` via `@anvia/core` untuk ekstraksi skema template dan intisari klarifikasi.
- [ ] Implementasikan adapter Qdrant di agent untuk *context retrieval* dokumen acuan.
- [ ] Testing skenario penyusunan BRD dan modifikasi via `runner.dev.ts`.

### Fase 2: Backend API, Storage R2, OCR Vision & Background Workers (Minggu 2)
- [ ] Perbarui skema database Prisma (`schema.prisma`) dengan model `Document`, `BrdDocument`, `BrdVersion`, `Project`, dan `UserSetting`.
- [ ] Setup Docker Compose dev (PostgreSQL, Redis, Qdrant).
- [ ] Jalankan migrasi database (`prisma migrate dev`).
- [ ] Konfigurasi upload berkas ke Cloudflare R2 menggunakan `@anvia/client-s3`.
- [ ] Bangun worker BullMQ + ioredis untuk:
  - Ekstraksi teks & OCR gambar flowchart menggunakan `@anvia/mistral`.
  - Chunking semantik & kalkulasi embedding menggunakan `@anvia/transformer`.
  - Ingestion vektor ke Qdrant menggunakan `@anvia/qdrant`.
  - Export PDF renderer (mengubah Markdown BRD menjadi file PDF siap unduh).
- [ ] Implementasi modul API Hono:
  - `/chat`: Streaming chat dengan `@anvia/server`, persistensi sesi `@anvia/memory-prisma`.
  - `/document`: Upload berkas, status worker, dan ekstraksi template standar.
  - `/brd`: CRUD BRD, simpan versi (*snapshot*), diff versi, dan endpoint ekspor (MD/PDF).
  - `/settings`: Get & update konfigurasi AI provider, custom prompt, dan API keys.

### Fase 3: Web Platform, shadcn/ui, Split Editor & Settings (Minggu 3)
- [ ] Inisialisasi dan konfigurasi pustaka komponen **shadcn/ui** di `apps/platform`.
- [ ] Integrasikan `@anvia/react` dan `@anvia/react-ui` untuk penanganan streaming chat dan interaksi percakapan.
- [ ] Bangun layout utama aplikasi:
  - Sidebar: navigasi sesi, status storage, tombol *New Chat*, daftar dokumen sesi aktif.
  - Chat Pane: interaksi percakapan, pertanyaan klarifikasi AI, rendering bubble pesan.
  - Document Pane (*Split View*): Editor Markdown interaktif (`@uiw/react-md-editor`), live preview, tombol save version, dan tombol ekspor Markdown & PDF.
- [ ] Implementasikan popover autocomplete `@mention` untuk mencari dan menyalin dokumen lintas sesi.
- [ ] Implementasi upload foto flowchart dengan tombol verifikasi instan.
- [ ] Bangun halaman **Settings**:
  - Konfigurasi tema (Light/Dark/System).
  - Pilihan AI Provider (OpenAI, Mistral, Ollama) & model selector.
  - Input custom API Key & Base URL.
  - Textarea Custom System Prompt Instructions.

### Fase 4: Validasi End-to-End, UAT, & Penguatan Sistem (Minggu 4)
- [ ] Uji coba skenario lengkap: Upload Template Standar $\to$ Masukkan User Story $\to$ Jawab Klarifikasi AI $\to$ Review Draf BRD di Editor $\to$ Upload Foto Flowchart $\to$ Verifikasi Alur $\to$ Edit Manual $\to$ Ekspor PDF.
- [ ] Uji ketahanan memori agen (multi-turn conversation) dan *rollback* riwayat versi BRD.
- [ ] Uji performa pipeline OCR `@anvia/mistral` dan embedding `@anvia/transformer`.
- [ ] Pembersihan kode, linting (`oxlint`), formatting (`oxfmt`), dan typecheck (`tsc`) di seluruh monorepo.

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
