export type TemplateSectionView = {
  id: string;
  title: string;
  required: boolean;
  purpose: string | null;
  expectedFormat: string | null;
  order: number;
};

export type TemplateStructureView = {
  templateName: string | null;
  description: string | null;
  sourceFormat: string | null;
  language: string | null;
  acceptanceStyle: string | null;
  idConventions: string[];
  sections: TemplateSectionView[];
};

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Normalisasi `templateStructure` dari API menjadi bentuk yang aman ditampilkan.
 * Urutan section mengikuti `order`, lalu urutan aslinya sebagai fallback.
 */
export function parseTemplateStructure(value: unknown): TemplateStructureView | null {
  const record = asRecord(value);
  const rawSections = Array.isArray(record.sections) ? record.sections : [];

  const sections = rawSections.flatMap((item, index): TemplateSectionView[] => {
    const section = asRecord(item);
    const title = asText(section.title);
    if (!title) return [];
    const order =
      typeof section.order === "number" && Number.isFinite(section.order)
        ? section.order
        : index + 1;
    return [
      {
        id: asText(section.id) ?? `section_${index + 1}`,
        title,
        required: section.required === true,
        purpose: asText(section.purpose),
        expectedFormat: asText(section.expectedFormat),
        order,
      },
    ];
  });

  if (sections.length === 0) return null;
  sections.sort((a, b) => a.order - b.order);

  const metadata = asRecord(record.metadata);
  const idConventions = (Array.isArray(record.idConventions) ? record.idConventions : []).flatMap(
    (item) => {
      const text = asText(item);
      return text ? [text] : [];
    },
  );

  return {
    templateName: asText(metadata.templateName),
    description: asText(metadata.description),
    sourceFormat: asText(metadata.sourceFormat),
    language: asText(record.language),
    acceptanceStyle: asText(record.acceptanceStyle),
    idConventions,
    sections,
  };
}
