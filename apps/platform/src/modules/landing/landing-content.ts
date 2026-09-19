import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  BadgeCheck,
  BookOpenText,
  CheckCircle2,
  Download,
  FileInput,
  FileText,
  FolderKanban,
  GitCompareArrows,
  Globe,
  History,
  Layers,
  LayoutTemplate,
  ListTree,
  MessageCircleQuestion,
  PenLine,
  ScanText,
  SearchCheck,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TextSearch,
} from "lucide-react";

export type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  meta: string;
};

export type FeatureGroup = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  features: Feature[];
};

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "penyusunan",
    icon: LayoutTemplate,
    title: "Penyusunan otomatis",
    description:
      "Dari kebutuhan mentah menjadi dokumen lengkap, mengikuti struktur baku perusahaan.",
    features: [
      {
        icon: Layers,
        title: "Template perusahaan jadi acuan",
        body: "Unggah template BRD atau susun manual; strukturnya diekstrak, Anda review, lalu dipakai konsisten untuk semua draft berikutnya.",
        meta: "ID BR-### / FR-###",
      },
      {
        icon: Sparkles,
        title: "User story menjadi BRD v1",
        body: "Satu user story menjadi BRD lengkap: diagram alur mermaid, kriteria Given/When/Then, asumsi, risiko, dan GAP yang eksplisit.",
        meta: "Proses 2–5 menit",
      },
      {
        icon: FileInput,
        title: "Impor BRD yang sudah ada",
        body: "Unggah berkas atau tempel teks BRD lama; isinya diekstrak menjadi BRD v1 untuk ditinjau dan disempurnakan lewat obrolan.",
        meta: "Maks 20 MB",
      },
      {
        icon: MessageCircleQuestion,
        title: "Klarifikasi terarah",
        body: "Tanpa asumsi diam-diam. Ambiguitas penting muncul sebagai pertanyaan fokus dengan opsi jawaban atau jawaban bebas.",
        meta: "Maks 2 putaran × 3 pertanyaan",
      },
    ],
  },
  {
    id: "konteks",
    icon: BookOpenText,
    title: "Konteks & grounding",
    description:
      "Setiap jawaban dan klausul berpijak pada dokumen project, bukan ingatan model semata.",
    features: [
      {
        icon: ScanText,
        title: "Dokumen project jadi sumber jawaban",
        body: "PDF, DOCX, Markdown, TXT, dan gambar (OCR) diindeks sebagai vektor — jawaban agen selalu bisa dilacak ke sumbernya.",
        meta: "Termasuk OCR gambar",
      },
      {
        icon: AtSign,
        title: "Sebut file dengan @",
        body: "Ketik @ di composer atau pilih dari daftar dokumen; konteks berkas langsung masuk ke percakapan dengan agen.",
        meta: "Maks 10 MB per lampiran",
      },
      {
        icon: SearchCheck,
        title: "Knowledge base per project",
        body: "Seluruh sesi dalam satu project berbagi dokumen yang sama, dengan pencarian konteks terisolasi per pengguna.",
        meta: "Lintas sesi",
      },
      {
        icon: Globe,
        title: "Riset kebutuhan via web",
        body: "Agen dapat mencari di web untuk melengkapi konteks, dengan kueri yang dibatasi dan dibersihkan dari data sensitif.",
        meta: "Maks 5 pencarian per proses",
      },
    ],
  },
  {
    id: "review",
    icon: ShieldCheck,
    title: "Review & kendali",
    description:
      "Agen menyiapkan, Anda yang memutuskan. Tidak ada perubahan yang tersimpan tanpa persetujuan.",
    features: [
      {
        icon: GitCompareArrows,
        title: "Setiap perubahan lewat pratinjau diff",
        body: "Perubahan tampil sebagai diff Per Bagian, Side-by-Side, atau Dokumen Penuh. Setujui untuk menjadi versi baru, atau tolak usulannya.",
        meta: "Tidak ada perubahan diam-diam",
      },
      {
        icon: History,
        title: "Riwayat versi penuh",
        body: "Semua snapshot tersimpan sebagai versi. Bandingkan antar versi dan pulihkan kapan saja tanpa kehilangan riwayat.",
        meta: "Pulihkan = versi baru",
      },
      {
        icon: BadgeCheck,
        title: "Status & jejak persetujuan",
        body: "Alur Draft → Dalam review → Disetujui dengan waktu dan pelaku persetujuan yang tercatat untuk kebutuhan audit.",
        meta: "Draft → Dalam review → Disetujui",
      },
      {
        icon: TextSearch,
        title: "Pencarian klausul & daftar isi",
        body: "Cari klausul dengan sorotan langsung di pratinjau dan lompat cepat antar bagian lewat daftar isi dokumen.",
        meta: "Sorotan pencarian",
      },
    ],
  },
  {
    id: "output",
    icon: SlidersHorizontal,
    title: "Output & konfigurasi",
    description: "Dokumen siap dibagikan, dengan kendali penuh atas gaya, model, dan tampilan.",
    features: [
      {
        icon: Download,
        title: "Export Markdown & PDF",
        body: "Markdown untuk repo, PDF bernomor halaman untuk stakeholder — dengan watermark status sampai dokumen disetujui.",
        meta: "MD + PDF",
      },
      {
        icon: ListTree,
        title: "Template builder manual",
        body: "Susun struktur sendiri: urutan seksi drag-and-drop, seksi wajib, format keluaran, hingga contoh isi per seksi.",
        meta: "Tanpa berkas? Bisa manual",
      },
      {
        icon: PenLine,
        title: "Preset prompt industri",
        body: "Tiga preset siap pakai: Standar Enterprise & Perbankan, SaaS & Agile Sprint-Ready, dan Regulated & Audit Heavy.",
        meta: "Bisa dikustom penuh",
      },
      {
        icon: ServerCog,
        title: "Routing model & provider",
        body: "Atur model per tingkat kesulitan (easy/medium/hard) dan pilih OpenRouter default atau provider OpenAI-compatible sendiri.",
        meta: "Terang / gelap / sistem",
      },
    ],
  },
];

export type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
  note: string;
};

export const STEPS: Step[] = [
  {
    icon: Settings2,
    title: "Siapkan template BRD",
    body: "Di workspace, buka Pengaturan → Template Struktur BRD. Unggah standar perusahaan (.md, .pdf, .docx) atau susun strukturnya manual; template aktif otomatis setelah ekstraksi selesai.",
    note: "Wajib untuk mode user story; mode impor BRD tetap bisa berjalan tanpa template.",
  },
  {
    icon: FolderKanban,
    title: "Buat project",
    body: "Satu project menampung satu BRD, dokumen referensi, dan seluruh sesi percakapannya. Anda bisa rename, hapus, dan melihat ringkasan dokumen serta sesi.",
    note: "Satu project hanya memiliki satu BRD. Untuk BRD baru, buat project baru.",
  },
  {
    icon: PenLine,
    title: "Pilih jalur penulisan",
    body: "Tulis user story dan lampirkan referensi bila ada, atau impor BRD lama melalui berkas/paste teks untuk disejajarkan dengan struktur template.",
    note: "Impor BRD maksimal 20 MB; PDF hasil scan diproses lebih lama.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Jawab klarifikasi",
    body: "Agen mengajukan pertanyaan fokus dengan opsi jawaban — pilih opsi atau tulis jawaban sendiri. Setelah maksimal dua putaran, BRD disusun.",
    note: "Butuh bantuan menjawab? Gunakan “Salin pertanyaan” untuk dibantu agen lain.",
  },
  {
    icon: GitCompareArrows,
    title: "Review & setujui",
    body: "Setiap penyusunan dan perubahan tampil sebagai pratinjau diff. Setujui untuk membuat versi baru (Setujui & Buat vN.0), atau tolak usulannya tanpa mengubah dokumen.",
    note: "Penyusunan BRD memakan 2–5 menit dan dapat dilanjutkan bila terputus.",
  },
  {
    icon: Download,
    title: "Kelola versi & export",
    body: "Bandingkan versi, pulihkan bila perlu, lalu ajukan review. Setelah berstatus Disetujui, unduh Markdown atau PDF siap dibagikan.",
    note: "PDF diberi watermark selama status belum Disetujui.",
  },
];

export const TRUST_POINTS = [
  "Template perusahaan",
  "Klarifikasi ≤ 2 putaran",
  "Approval + jejak audit",
  "Export MD / PDF",
];

export type WorkflowPoint = {
  icon: LucideIcon;
  title: string;
  caption: string;
};

export const WORKFLOW_POINTS: WorkflowPoint[] = [
  { icon: LayoutTemplate, title: "Template", caption: "Struktur baku" },
  { icon: FolderKanban, title: "Project", caption: "Ruang kerja" },
  { icon: FileText, title: "Story / Impor", caption: "Sumber kebutuhan" },
  { icon: MessageCircleQuestion, title: "Klarifikasi", caption: "Maks 2 putaran" },
  { icon: GitCompareArrows, title: "Review diff", caption: "Setujui / tolak" },
  { icon: CheckCircle2, title: "Approve", caption: "Status & audit" },
  { icon: Download, title: "Export", caption: "Markdown / PDF" },
];

export type FaqItem = { question: string; answer: string };

export const FAQS: FaqItem[] = [
  {
    question: "Apakah saya perlu API key sendiri?",
    answer:
      "Tidak. Lingkungan ini memakai model default server. Bila ingin memakai provider sendiri (OpenAI-compatible), atur Base URL, API key, dan model per tingkat kesulitan di Pengaturan → Model AI.",
  },
  {
    question: "Apakah template BRD wajib disiapkan lebih dulu?",
    answer:
      "Wajib untuk menyusun BRD dari user story. Untuk mengimpor BRD yang sudah ada, template tidak diperlukan — dokumen langsung diekstrak menjadi BRD v1.",
  },
  {
    question: "Format dan batas ukuran file apa saja yang didukung?",
    answer:
      "Lampiran: PDF, DOCX, Markdown, TXT, dan gambar (PNG, JPG, WEBP, TIFF) dengan OCR, maksimal 10 MB per berkas. Impor BRD menerima berkas atau teks sampai 20 MB.",
  },
  {
    question: "Bisakah saya mengedit BRD secara manual?",
    answer:
      "Perubahan dilakukan lewat obrolan dengan agen dan selalu tampil sebagai pratinjau diff untuk Anda setujui. Anda juga bisa menyalin Raw .MD, mengunduh dokumen, dan memulihkan versi sebelumnya.",
  },
  {
    question: "Bisakah satu project memiliki lebih dari satu BRD?",
    answer:
      "Tidak. Satu project memiliki satu BRD. Untuk menyusun BRD baru, buat project baru; perubahan BRD yang ada dilakukan lewat obrolan QA di sesi mana pun.",
  },
  {
    question: "Apa yang terjadi bila proses penyusunan terputus?",
    answer:
      "Progres klarifikasi tersimpan per project. Buka kembali project dan pilih “Lanjutkan penyusunan” — draf akan dilanjutkan dari checkpoint terakhir.",
  },
  {
    question: "Mengapa PDF saya memiliki watermark?",
    answer:
      "PDF diberi watermark Draft atau Dalam review sebagai penanda status. Watermark hilang setelah dokumen disetujui.",
  },
  {
    question: "Apakah aplikasi ini mendukung kolaborasi tim?",
    answer:
      "Saat ini alur persetujuan berjalan satu operator dalam lingkungan demo: belum ada berbagi project, komentar, atau peran pengguna.",
  },
];
