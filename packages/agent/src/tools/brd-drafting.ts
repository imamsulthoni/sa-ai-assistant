import { createTool } from "@anvia/core";
import { z } from "zod";

const clarificationSchema = z.object({
  id: z.string().min(1),
  answer: z.string().min(1),
});

/** Batas panjang satu contoh format per section (karakter). */
export const MAX_TEMPLATE_EXAMPLE_CHARS = 1200;
/** Anggaran total blok contoh yang disuntikkan ke prompt generate (karakter). */
export const MAX_TEMPLATE_EXEMPLAR_TOTAL_CHARS = 6000;

/**
 * Deskripsi field dipakai di `.describe()` agar ikut terkirim ke model lewat
 * JSON Schema (`z.toJSONSchema`). Selalu pasang `.describe()` di lapisan
 * terluar (setelah `.nullable()`/`.optional()`).
 */
const FIELD_DESCRIPTIONS = {
  id: "Slug unik section: huruf kecil, kata dipisah underscore (mis. aktor_dan_alur).",
  title: "Nama section yang generik dan dapat dipakai ulang untuk BRD apa pun, bukan nama fitur spesifik.",
  required: "true bila section selalu wajib ada di BRD sejenis; false bila opsional/bersyarat.",
  purpose:
    "Jenis informasi yang harus dimuat section ini (maks 2 kalimat). null bila tidak bisa digeneralisasi tanpa membocorkan data proyek.",
  expectedFormat:
    "Format penyajian: bullet, tabel beserta daftar kolomnya, Given/When/Then, checklist, mermaid, atau daftar ber-ID. null bila tidak dapat disimpulkan.",
  example:
    "Contoh singkat pola isi section yang sudah digeneralisasi dengan placeholder ([Aktor], [Field], [ID]); tanpa nama proyek/aktor/endpoint/angka nyata. null bila tidak ada pola yang bisa dicontohkan.",
  order: "Urutan section sesuai posisi di dokumen sumber, mulai dari 0, tanpa duplikat atau lompatan.",
  templateName: "Nama template generik yang berlaku lintas inisiatif (mis. 'Template BRD Standar').",
  description: "1 kalimat tentang ciri struktur template, mengikuti bab yang benar-benar ada di dokumen sumber.",
  sourceFormat: "Gaya penulisan dokumen sumber: 'naratif', 'tabular', atau 'campuran'. null bila tidak pasti.",
  idConventions: "Pola identifier generik yang dipakai dokumen sumber (mis. 'BR-###'); angka diganti '###'.",
  language: "Kode/nama bahasa dokumen sumber (mis. 'id', 'en').",
  acceptanceStyle: "Gaya penulisan kriteria penerimaan (mis. 'Given/When/Then'). null bila tidak ada.",
} as const;

const BrdTemplateSectionSchema = z.object({
  id: z.string().min(1).describe(FIELD_DESCRIPTIONS.id),
  title: z.string().min(1).describe(FIELD_DESCRIPTIONS.title),
  required: z.boolean().describe(FIELD_DESCRIPTIONS.required),
  purpose: z.string().min(1).max(500).nullable().optional().describe(FIELD_DESCRIPTIONS.purpose),
  expectedFormat: z
    .string()
    .min(1)
    .max(500)
    .nullable()
    .optional()
    .describe(FIELD_DESCRIPTIONS.expectedFormat),
  example: z
    .string()
    .max(MAX_TEMPLATE_EXAMPLE_CHARS)
    .nullable()
    .optional()
    .describe(FIELD_DESCRIPTIONS.example),
  order: z.number().int().nonnegative().nullable().optional().describe(FIELD_DESCRIPTIONS.order),
});

const BrdTemplateStructureSchema = z.object({
  sections: z.array(BrdTemplateSectionSchema).min(1).max(30),
  idConventions: z.array(z.string().min(1).max(200)).max(20).default([]),
  language: z.string().min(1).max(60).nullable().optional(),
  acceptanceStyle: z.string().min(1).max(200).nullable().optional(),
  metadata: z
    .object({
      templateName: z.string().nullable(),
      description: z.string().nullable(),
      sourceFormat: z.string().nullable(),
    })
    .partial()
    .optional(),
});

export type BrdTemplateSection = z.infer<typeof BrdTemplateSectionSchema>;
export type BrdTemplateStructure = z.infer<typeof BrdTemplateStructureSchema>;
export const TemplateStructureSchema = BrdTemplateStructureSchema;
// OpenAI Structured Outputs requires every object property to be required.
// Nullable fields preserve the distinction between "not found" and invalid data.
export const TemplateExtractionSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().min(1).describe(FIELD_DESCRIPTIONS.id),
        title: z.string().min(1).describe(FIELD_DESCRIPTIONS.title),
        required: z.boolean().describe(FIELD_DESCRIPTIONS.required),
        purpose: z.string().min(1).max(500).nullable().describe(FIELD_DESCRIPTIONS.purpose),
        expectedFormat: z
          .string()
          .min(1)
          .max(500)
          .nullable()
          .describe(FIELD_DESCRIPTIONS.expectedFormat),
        example: z
          .string()
          .max(MAX_TEMPLATE_EXAMPLE_CHARS)
          .nullable()
          .describe(FIELD_DESCRIPTIONS.example),
        order: z.number().int().nonnegative().nullable().describe(FIELD_DESCRIPTIONS.order),
      }),
    )
    .min(1)
    .max(30)
    .describe("Daftar section terurut yang membentuk struktur template."),
  idConventions: z
    .array(z.string().min(1).max(200))
    .max(20)
    .describe(FIELD_DESCRIPTIONS.idConventions),
  language: z.string().min(1).max(60).nullable().describe(FIELD_DESCRIPTIONS.language),
  acceptanceStyle: z.string().min(1).max(200).nullable().describe(FIELD_DESCRIPTIONS.acceptanceStyle),
  metadata: z.object({
    templateName: z.string().nullable().describe(FIELD_DESCRIPTIONS.templateName),
    description: z.string().nullable().describe(FIELD_DESCRIPTIONS.description),
    sourceFormat: z.string().nullable().describe(FIELD_DESCRIPTIONS.sourceFormat),
  }),
});

const KNOWN_SECTION_HINTS: Array<{ match: RegExp; body: string }> = [
  {
    match: /document.?control|kontrol.?dokumen/i,
    body: "- Status: Draft\n- Template: {{templateName}}\n- Tanggal: (isi tanggal generasi)",
  },
  {
    match: /summar|scope|ringkas|ruang.?lingkup/i,
    body: "{{userStory}}",
  },
  {
    match: /clarif|klarifikasi/i,
    body: "{{clarifications}}",
  },
  {
    match: /business.?requirement|business.?rule|kebutuhan.?bisnis|aturan.?bisnis/i,
    body: "### BR-001\nSistem harus mewujudkan hasil bisnis yang diminta dalam user story secara jelas dan terukur.",
  },
  {
    match: /functional|fungsional/i,
    body: "### FR-001\nSistem harus menerima dan memproses aksi yang diminta pengguna serta menampilkan hasil sukses atau gagal yang jelas.",
  },
  {
    match: /acceptance|kriteria.?terima/i,
    body: "- Diberikan user story yang disebutkan, ketika aktor yang berwenang melakukan aksi yang diminta, maka sistem menghasilkan outcome bisnis yang diharapkan.",
  },
  {
    match: /assumption|asumsi|open.?question|review/i,
    body: "{{assumptions}}",
  },
  {
    match: /reference|referensi|traceab/i,
    body: "{{referenceContext}}",
  },
  {
    match: /flowchart|diagram.?alur|alur.?proses|proses.?bisnis|workflow/i,
    body: "{{flowchart}}",
  },
];

function orderedSections(template: BrdTemplateStructure): BrdTemplateSection[] {
  return [...template.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function sectionBody(
  section: BrdTemplateSection,
  fallback: {
    userStory: string;
    clarificationText: string;
    assumptionsText: string;
    referenceText: string;
    flowchart: string;
  },
  template: BrdTemplateStructure,
): string {
  const hint = KNOWN_SECTION_HINTS.find((candidate) =>
    candidate.match.test(`${section.id} ${section.title} ${section.purpose ?? ""}`),
  );
  // purpose/expectedFormat adalah deskripsi struktur, bukan isi dokumen: jangan
  // pernah dipakai sebagai badan section. Tanpa hint, biarkan penulis mengisi.
  const body = hint?.body ?? `- (see ${section.id})`;
  return body
    .replaceAll(
      "{{templateName}}",
      template.metadata?.templateName ?? "template custom yang disetujui",
    )
    .replaceAll("{{userStory}}", fallback.userStory)
    .replaceAll("{{clarifications}}", fallback.clarificationText)
    .replaceAll("{{assumptions}}", fallback.assumptionsText)
    .replaceAll("{{referenceContext}}", fallback.referenceText)
    .replaceAll("{{flowchart}}", fallback.flowchart);
}

export type TemplateExtraction = z.infer<typeof TemplateExtractionSchema>;

const COPIED_WINDOW_CHARS = 60;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * True bila nilai memuat potongan verbatim (>= 60 karakter) dari dokumen sumber.
 * Dipakai untuk mencegah isi dokumen template ikut tersimpan sebagai "purpose".
 */
export function copiedFromTemplateSource(value: string, source: string): boolean {
  const candidate = normalizeText(value);
  const haystack = normalizeText(source);
  if (candidate.length < COPIED_WINDOW_CHARS || !haystack) return false;
  for (let start = 0; start + COPIED_WINDOW_CHARS <= candidate.length; start += 20) {
    if (haystack.includes(candidate.slice(start, start + COPIED_WINDOW_CHARS))) return true;
  }
  return false;
}

const CONTENT_SIGNALS: RegExp[] = [
  /\b(BR|FR|NFR|UC|API)[-_ ]?\d{1,4}\b/i,
  /https?:\/\//i,
  /\b\d+(?:[.,]\d+)?\s*(?:%|ms|detik|menit|jam|hari|juta|ribu)\b/i,
];

/** Singkatan generik/teknis yang aman muncul di deskripsi struktur. */
const GENERIC_ACRONYMS = new Set([
  "BRD",
  "API",
  "UI",
  "UX",
  "SLA",
  "KPI",
  "BR",
  "FR",
  "NFR",
  "QA",
  "UAT",
  "RACI",
  "ID",
  "IT",
  "MD",
  "PDF",
  "DOCX",
  "XLSX",
  "CSV",
  "REST",
  "JSON",
  "XML",
  "SQL",
  "HTTP",
  "HTTPS",
  "URL",
  "URI",
  "CRUD",
  "SSO",
  "JWT",
  "CORS",
]);

/** Frasa generik yang memang boleh tampil dalam Title Case. */
const GENERIC_PHRASES = [
  "business requirement document",
  "product requirement document",
  "user story",
  "acceptance criteria",
];

const PROJECT_PATTERNS: RegExp[] = [
  /\b(?:dokumen|file|berkas)\s+(?:ini|tersebut|yang diunggah)\b/i,
  /\b(?:isi|konten)\s+dokumen\b/i,
  /\b(?:aplikasi|sistem|platform|modul|produk|fitur|proyek|inisiatif)\s+[A-Z][\w-]+/,
];

/**
 * Deteksi teks yang menyebut hal spesifik proyek (nama sistem, singkatan seperti
 * "LMS", frasa Title Case, atau rujukan ke dokumen sumber) alih-alih struktur.
 */
export function looksProjectSpecific(value: string): boolean {
  if (!value.trim()) return false;

  const acronyms = value.match(/\b[A-Z]{3,}\b/g) ?? [];
  if (acronyms.some((acronym) => !GENERIC_ACRONYMS.has(acronym))) return true;

  if (/(?:^|[\s(])(?:[A-Z][a-z]+\s+){1,}[A-Z][a-z]+/.test(value)) {
    const normalized = normalizeText(value);
    if (!GENERIC_PHRASES.some((phrase) => normalized.includes(phrase))) return true;
  }

  return PROJECT_PATTERNS.some((pattern) => pattern.test(value));
}

/** Nilai yang menyerupai konten bisnis (bukan deskripsi struktur) dianggap bocor. */
export function looksLikeTemplateContent(value: string, source: string): boolean {
  if (copiedFromTemplateSource(value, source)) return true;
  if (looksProjectSpecific(value)) return true;
  return CONTENT_SIGNALS.filter((pattern) => pattern.test(value)).length >= 2;
}

/** Deskripsi template generik yang diturunkan dari struktur, bukan isi dokumen. */
function genericTemplateDescription(sections: TemplateExtraction["sections"]): string {
  const titles = [...sections]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((section) => section.title)
    .filter(Boolean);
  const shown = titles.slice(0, 4);
  const rest = titles.length - shown.length;
  return `Template BRD dengan ${sections.length} bab standar: ${shown.join(", ")}${
    rest > 0 ? `, dan ${rest} bab lainnya` : ""
  }.`;
}

/**
 * Buang purpose/format/metadata yang menyalin atau menyebut isi dokumen. Nilai
 * section yang bocor menjadi null; metadata yang bocor digeneralisasi agar
 * template tetap dapat dipakai ulang lintas inisiatif.
 */
export function sanitizeTemplateExtraction(
  extraction: TemplateExtraction,
  source: string,
): TemplateExtraction {
  const clean = (value: string | null): string | null => {
    if (!value) return null;
    return looksLikeTemplateContent(value, source) ? null : value;
  };

  // Contoh format memang memuat pola isi, jadi hanya salinan verbatim dari
  // dokumen sumber yang dibuang — pola tergeneralisasi tetap dipertahankan.
  const cleanExample = (value: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return copiedFromTemplateSource(trimmed, source) ? null : trimmed;
  };

  const templateName = extraction.metadata.templateName;
  const description = extraction.metadata.description;

  return {
    ...extraction,
    sections: extraction.sections.map((section) => ({
      ...section,
      purpose: clean(section.purpose),
      expectedFormat: clean(section.expectedFormat),
      example: cleanExample(section.example),
    })),
    acceptanceStyle: clean(extraction.acceptanceStyle),
    metadata: {
      ...extraction.metadata,
      templateName:
        templateName &&
        !looksProjectSpecific(templateName) &&
        !copiedFromTemplateSource(templateName, source)
          ? templateName
          : "Template BRD Standar",
      description:
        description && !looksLikeTemplateContent(description, source)
          ? description
          : genericTemplateDescription(extraction.sections),
    },
  };
}

export function normalizeTemplateStructure(value: unknown): BrdTemplateStructure | null {
  const parsed = BrdTemplateStructureSchema.safeParse(value);
  if (!parsed.success) return null;
  return { ...parsed.data, sections: orderedSections(parsed.data) };
}

export function renderTemplateScaffold(
  template: BrdTemplateStructure,
  parts: {
    userStory: string;
    clarificationText: string;
    assumptionsText: string;
    referenceText: string;
    flowchart: string;
  },
): string {
  const sections = orderedSections(template);
  return `${sections
    .map(
      (section, index) =>
        `## ${index + 1}. ${section.title}\n${sectionBody(section, parts, template) || `- (see ${section.id})`}`,
    )
    .join("\n\n")}\n`;
}

export function validateBrdAgainstTemplate(
  markdown: string,
  template: BrdTemplateStructure,
): { missingRequired: string[]; missingIdConventions: string[] } {
  const missingRequired = orderedSections(template)
    .filter((section) => section.required)
    .filter((section) => {
      if (markdown.includes(`- (see ${section.id})`)) return true;
      const candidates = [section.title, section.id].filter(Boolean);
      return !candidates.some((candidate) =>
        markdown.toLowerCase().includes(candidate.toLowerCase()),
      );
    })
    .map((section) => section.id);
  const missingIdConventions = template.idConventions.filter((convention) => {
    try {
      return !new RegExp(convention).test(markdown);
    } catch {
      return !markdown.includes(convention);
    }
  });
  return { missingRequired, missingIdConventions };
}

export function templateInstructionBlock(template: BrdTemplateStructure): string {
  const lines = orderedSections(template).map(
    (section, index) =>
      `${index + 1}. ${section.title} [${section.id}]${section.required ? " (required)" : " (optional)"}${section.purpose ? ` - ${section.purpose}` : ""}${section.expectedFormat ? ` Format: ${section.expectedFormat}` : ""}`,
  );
  const conventions = template.idConventions.length
    ? `ID conventions: ${template.idConventions.join("; ")}`
    : "ID conventions: keep stable BR-### / FR-### identifiers.";
  const language = template.language ? `Language: ${template.language}.` : "";
  const acceptance = template.acceptanceStyle
    ? `Acceptance style: ${template.acceptanceStyle}.`
    : "";
  return [
    "Active BRD template (approved by the System Analyst - output MUST follow it):",
    ...lines,
    conventions,
    [language, acceptance].filter(Boolean).join(" "),
    "Rules: keep section order and titles; required sections MUST appear; a required section without source support MUST report a gap instead of inventing content.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Blok contoh bentuk isi per section yang disuntikkan ke prompt generate.
 * Tujuannya meniru TINGKAT KEDALAMAN dan FORMAT (tabel/bullet/Given-When-Then),
 * bukan menyalin data proyek — total dibatasi anggaran karakter.
 */
export function templateExemplarBlock(
  template: BrdTemplateStructure,
  options: { maxChars?: number } = {},
): string {
  const budget = options.maxChars ?? MAX_TEMPLATE_EXEMPLAR_TOTAL_CHARS;
  const lines: string[] = [];
  let used = 0;
  for (const section of orderedSections(template)) {
    if (!section.example?.trim()) continue;
    const line = `- ${section.title}: ${section.example.trim()}`;
    if (used + line.length > budget) break;
    used += line.length;
    lines.push(line);
  }
  if (!lines.length) return "";
  return [
    "CONTOH FORMAT & KEDALAMAN PER SECTION (acuan GAYA dari dokumen contoh; JANGAN salin entitas, nama proyek/produk, aktor, endpoint, angka, atau aturan bisnisnya):",
    ...lines,
    "Pakai contoh di atas hanya untuk meniru tingkat detail dan bentuk penyajian (tabel/bullet/Given-When-Then), lalu isi dengan data dari user story, jawaban klarifikasi, dan konteks referensi.",
  ].join("\n");
}

export function createBrdDraft(
  userStory: string,
  clarifications: readonly z.infer<typeof clarificationSchema>[],
  template: unknown,
  referenceContext = "",
  flowchart = "",
) {
  const clarificationText = clarifications.length
    ? clarifications.map((item) => `- ${item.id}: ${item.answer}`).join("\n")
    : "- Tidak ada jawaban klarifikasi; detail yang belum tersedia ditandai sebagai asumsi.";
  const assumptions = clarifications.length
    ? []
    : ["Detail aktor, aturan validasi, dan skenario gagal perlu dikonfirmasi oleh System Analyst."];
  const normalized = normalizeTemplateStructure(template);
  const parts = {
    clarificationText,
    assumptionsText: assumptions.length
      ? assumptions.map((item) => `- ASUMSI: ${item}`).join("\n")
      : "- Tidak ada asumsi yang teridentifikasi dari konteks yang diberikan.",
    referenceText: referenceContext.trim() || "- Tidak ada konteks referensi yang diberikan.",
    flowchart:
      flowchart.trim() || "- Alur proses utama belum tersedia; deskripsikan alur pada bagian ini.",
  };
  const markdown = normalized
    ? `# BRD\n\n${renderTemplateScaffold(normalized, {
        userStory,
        clarificationText: `\n${userStory}\n\n${parts.clarificationText}`,
        assumptionsText: parts.assumptionsText,
        referenceText: parts.referenceText,
        flowchart: parts.flowchart,
      })}`
    : `# BRD

## 1. Kontrol dokumen
- Status: Draft
- Template: bawaan sistem
- Tanggal: (isi tanggal generasi)

## 2. Ringkasan dan ruang lingkup
${userStory}

## 3. Klarifikasi
${parts.clarificationText}

## 4. Kebutuhan bisnis dan aturan
### BR-001
Sistem harus mewujudkan hasil bisnis yang diminta dalam user story secara jelas dan terukur.

## 5. Kebutuhan fungsional
### FR-001
Sistem harus menerima dan memproses aksi yang diminta pengguna serta menampilkan hasil sukses atau gagal yang jelas.

## 6. Kriteria penerimaan
- Diberikan user story yang disebutkan, ketika aktor yang berwenang melakukan aksi yang diminta, maka sistem menghasilkan outcome bisnis yang diharapkan.

## 7. Konteks referensi
${parts.referenceText}

## 8. Asumsi dan pertanyaan terbuka
${parts.assumptionsText}
`;
  return { markdown, assumptions, templateSource: normalized ? "custom" : ("builtin" as const) };
}

export const draftBrdTool = createTool({
  name: "draft_brd",
  description:
    "Create a grounded BRD draft after the analyst agent has resolved or explicitly accepted remaining gaps.",
  inputSchema: z.object({
    userStory: z.string().min(1),
    clarifications: z.array(clarificationSchema).default([]),
    templateStructure: z.unknown().optional(),
    referenceContext: z.string().default(""),
    flowchart: z.string().default(""),
    force: z.boolean().default(false),
  }),
  execute: async ({
    userStory,
    clarifications,
    templateStructure,
    referenceContext,
    flowchart,
    force,
  }) => {
    const sufficient = clarifications.length > 0 || referenceContext.trim().length > 0 || force;
    if (!sufficient) {
      return {
        ready: false as const,
        markdown: null,
        assumptions: [],
        traceability: [],
        gaps: [
          "Clarification is required before drafting, or pass force=true after the round cap or an explicit skip.",
        ],
      };
    }
    const draft = createBrdDraft(
      userStory,
      clarifications,
      templateStructure,
      referenceContext,
      flowchart,
    );
    const normalized = normalizeTemplateStructure(templateStructure);
    const validation = normalized ? validateBrdAgainstTemplate(draft.markdown, normalized) : null;
    const gaps = [
      ...(validation?.missingRequired.map((id) => `Template section missing: ${id}`) ?? []),
      ...(validation?.missingIdConventions.map(
        (convention) => `ID convention not satisfied: ${convention}`,
      ) ?? []),
    ];
    return {
      ready: true as const,
      ...draft,
      gaps,
      traceability: [
        { source: "userStory" as const, target: "BR-001" },
        ...clarifications.map((item) => ({
          source: "clarification" as const,
          id: item.id,
          target: "FR-001",
        })),
        ...(referenceContext.trim()
          ? [{ source: "document" as const, target: "BR-001" as const }]
          : []),
      ],
    };
  },
});
