export const APP_NAME = "Halodocs";
export const APP_TAGLINE = "SA AI Assistant";
export const APP_TITLE = `${APP_NAME} — ${APP_TAGLINE}`;

export const STATUS_LABEL: Record<string, string> = {
  UPLOADING: "MENGUNGGAH",
  PROCESSING: "DIPROSES",
  READY: "SIAP",
  PENDING_CONFIRMATION: "MENUNGGU KONFIRMASI",
  FAILED: "GAGAL",
};

export const BRD_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "Dalam review",
  APPROVED: "Disetujui",
};

export const BRD_STATUS_ACTIONS: Record<
  string,
  Array<{ label: string; status: "DRAFT" | "IN_REVIEW" | "APPROVED" }>
> = {
  DRAFT: [{ label: "Ajukan review", status: "IN_REVIEW" }],
  IN_REVIEW: [
    { label: "Setujui", status: "APPROVED" },
    { label: "Kembalikan", status: "DRAFT" },
  ],
  APPROVED: [{ label: "Buka kembali", status: "IN_REVIEW" }],
};

export const TOOL_LABEL: Record<string, string> = {
  search_context: "Mencari konteks dokumen",
  modify_brd: "Menyiapkan perubahan BRD",
  draft_brd: "Menyusun draf BRD",
  web_search: "Mencari di web",
  answer_brd_question: "Menelusuri BRD",
  elicit_clarifications: "Menyiapkan pertanyaan klarifikasi",
  get_template_structure: "Memeriksa struktur template",
  get_active_brd: "Membaca BRD aktif",
};

export function toolLabel(name: string): string {
  return TOOL_LABEL[name] ?? name;
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const COPY = {
  shell: {
    openMenu: "Buka menu",
    closeMenu: "Tutup menu",
    showSidebar: "Tampilkan sidebar",
    hideSidebar: "Sembunyikan sidebar",
  },
  chat: {
    brdReadyTitle: "BRD siap — ada yang bisa saya bantu?",
    brdReadyBody:
      "Tanyakan isi dokumen atau minta perubahan. Setiap perubahan ditampilkan sebagai pratinjau dulu sebelum Anda setujui.",
    emptyTitle: "Asisten Analis Sistem",
    emptyBody:
      "Ceritakan user story Anda, ajukan pertanyaan tentang BRD yang ada, atau minta pencarian web untuk riset kebutuhan.",
    documentsCount: (count: number) => `${count} Dokumen`,
    pendingProposal: "Usulan Revisi Klausul",
    reviewDiff: "Review Perbedaan Klausul (Diff)",
    agentWorking: "Agen sedang bekerja…",
    composerPlaceholderBrd: "Tanyakan tentang BRD… (tip: @ untuk menyebut file sesi)",
    composerPlaceholder: "Ceritakan user story Anda… (tip: @ untuk menyebut file sesi)",
    attachTitle: (limit: string) => `Lampirkan dokumen atau gambar (maks ${limit})`,
    mentionTitle: "Sebut file di sesi ini (@)",
  },
  quickPrompts: [
    "Ringkas BRD ini",
    "Temukan gap requirement",
    "Jelaskan FR pertama",
    "Temukan risiko dan dependensi",
  ],
  sidebar: {
    newChat: "Buat Sesi BRD Baru",
    conversations: "Daftar Sesi",
    noConversations: "Belum ada percakapan.",
    workspaceName: APP_NAME,
    messageCount: (count: number) => `${count} pesan`,
    badgeDiff: "Diff Usulan",
    badgeGenerating: "Menyusun",
    badgeDraft: "Draft",
    templateSection: "Template BRD",
    manage: "Atur",
    noTemplate: "Belum ada template aktif",
    allSettings: "Pengaturan Lengkap",
    sessionDocuments: "Dokumen sesi",
    uploadDocuments: "Unggah BRD, PDF, atau gambar untuk sesi ini.",
    loadingFiles: "Memuat berkas…",
    rename: "Ganti nama",
    delete: "Hapus",
    renameTitle: "Ganti nama percakapan",
    renameDescription: "Beri nama percakapan ini agar lebih mudah dikenali.",
    renamePlaceholder: "Judul percakapan",
    save: "Simpan",
    cancel: "Batal",
    deleteTitle: "Hapus percakapan?",
    deleteDescription: (title: string) =>
      `Percakapan “${title}” beserta seluruh pesannya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    deleteConfirm: "Hapus",
    deleteDocumentTitle: "Hapus dokumen?",
    deleteDocumentDescription: (title: string) =>
      `Dokumen “${title}” akan dihapus permanen dari penyimpanan, basis data, dan indeks pencarian sesi ini. Tindakan ini tidak bisa dibatalkan.`,
    deleteDocumentConfirm: "Hapus dokumen",
  },
  documents: {
    title: "Dokumen Referensi Sesi",
    description: (count: number) =>
      `${count} lampiran rujukan yang dapat di-mention (@) saat tanya jawab dengan AI Agent.`,
    dropTitle: "Drag & Drop file referensi di sini",
    dropHint: (limit: string) =>
      `Mendukung format PDF, Word (.docx), Markdown (.md), TXT, dan gambar (maks ${limit})`,
    choose: "Pilih File Dokumen",
    uploading: "Memproses…",
    listTitle: (count: number) => `Daftar Lampiran Terindeks (${count})`,
    empty: "Belum ada dokumen yang diunggah untuk sesi ini.",
    done: "Selesai",
  },
  workspace: {
    noSession: "Belum ada percakapan dipilih",
    noSessionAction: "Mulai percakapan baru",
    loading: "Memuat…",
    loadingConversation: "Memuat percakapan…",
    brdReady: "BRD siap",
    clarifying: "Klarifikasi",
    generating: "Menyusun",
    hideBrd: "Sembunyikan BRD",
    showBrd: "Tampilkan BRD",
    chatView: "Agen obrolan",
    brdView: "Dokumen BRD",
    resizePanes: "Ubah lebar panel agen obrolan dan panel dokumen BRD",
    brdPaneValue: (share: number) => `Panel BRD ${share}%`,
    dismissImport: "Batalkan antrian impor",
  },
  flow: {
    generatingTitle: "Menyusun Dokumen BRD",
    resumeTitle: "Penyusunan terputus",
    resumeBody:
      "Proses sebelumnya berhenti di tengah jalan. Jawaban Anda sudah tersimpan — lanjutkan untuk menyusun draf BRD.",
    resumeAction: "Lanjutkan penyusunan",
  },
  clarify: {
    roundLabel: (round: number) => `Putaran ${round} / 2`,
    answered: (answered: number, total: number) => `${answered}/${total} terjawab`,
    titleRound1: "Klarifikasi Ruang Lingkup & Metrik",
    titleRound2: "Klarifikasi Skenario Edge Case & SLA",
    questionLabel: "Klarifikasi",
    subtitle:
      "Pilih salah satu opsi atau tulis jawaban sendiri. Jawaban ini menjadi konteks BRD Anda.",
    customPlaceholder: "Tulis jawaban sendiri…",
    requiredError: "Lengkapi pertanyaan wajib sebelum melanjutkan.",
    preparing: "Menyiapkan BRD…",
    submitRound1: "Lanjut ke Putaran 2",
    submitRound2: "Generate Dokumen BRD v1",
    skip: "Lanjut dengan asumsi",
    skipHint: "Putaran terakhir — kekurangan akan dicatat sebagai asumsi eksplisit di dalam BRD.",
    nextRoundHint:
      "Anda akan mendapat satu putaran pertanyaan lanjutan bila masih ada yang belum jelas.",
  },
  newBrd: {
    eyebrow: "Acuan baku:",
    title: "Penyusunan BRD Baru",
    subtitle:
      "Susun BRD baru dari user story, atau impor BRD yang sudah ada untuk ditinjau dan disempurnakan bersama asisten.",
    modeStoryTab: "Input User Story",
    modeUploadTab: "Upload Dokumen",
    formTitle: "Formulir Kebutuhan Awal",
    fillSample: "Isi Contoh Data Cepat",
    featureName: "Nama Fitur / Inisiatif",
    userStory: "User Story Utama",
    businessObjective: "Tujuan Bisnis",
    targetUsers: "Target Pengguna",
    acceptanceCriteria: "Kriteria Keberhasilan Awal",
    technicalConstraints: "Batasan Teknis / Regulasi",
    startClarify: "Mulai Klarifikasi",
    clarifyHint: "Dilanjutkan 2 putaran klarifikasi ringkas sebelum generate BRD.",
    validation: "Mohon lengkapi minimal Nama Fitur dan User Story Utama.",
    pasteRequired: "Mohon pilih berkas atau tempelkan isi teks terlebih dahulu.",
    uploadTitle: "Upload / Tempel Dokumen Acuan",
    pickFile: "Pilih Dokumen",
    uploadHint: "Format: PDF, DOCX, Markdown, TXT",
    pasteLabel: "Atau Tempel Teks Dokumen",
    uploadFooterHint: "Dokumen akan diselaraskan dengan struktur template baku.",
    restructure: "Restrukturisasi ke BRD v1",
    attach: "Lampirkan referensi",
    chooseFile: "Pilih berkas BRD",
    import: "Impor BRD",
    importing: "Memproses dokumen…",
    importingHint:
      "Mengekstrak teks dan mengindeks dokumen. PDF hasil scan bisa memakan waktu lebih lama.",
  },
  notice: {
    brdReady: (title: string) =>
      `BRD v1 siap — draf “${title}” telah dibuat. Minta agen mengubahnya lewat obrolan.`,
    brdImported: (title: string) =>
      `BRD “${title}” berhasil diimpor. Tanyakan isinya atau minta perubahan — panel BRD akan muncul saat ada pratinjau yang perlu disetujui.`,
    importWaiting:
      "Menunggu dokumen selesai diproses — impor BRD dilanjutkan otomatis setelah siap.",
    importContinues: "Dokumen masih diproses. Impor akan dilanjutkan otomatis begitu dokumen siap.",
    referenceStillIndexing:
      "Referensi masih diproses. Pertanyaan awal mungkin belum memakainya, tetapi dokumen akan otomatis dipakai saat menyusun BRD.",
    dismiss: "Tutup",
  },
  errors: {
    emptyBrd: "Agen mengembalikan BRD kosong",
    generateStart: (message: string) => `Gagal memulai pembuatan BRD: ${message}`,
    importFailed: (message: string) => `Impor gagal: ${message}`,
    importPendingFailed: (title: string) =>
      `Dokumen “${title}” gagal diproses sehingga tidak bisa diimpor.`,
    generationTimeout:
      "Penyusunan memakan waktu lebih lama dari biasanya. Periksa koneksi lalu coba lanjutkan lagi.",
    attachmentTooLarge: (name: string, limit: string) => `${name} melebihi batas ${limit}.`,
    uploadFailed: "Gagal mengunggah berkas.",
    deleteFailed: "Gagal menghapus berkas.",
  },
} as const;
