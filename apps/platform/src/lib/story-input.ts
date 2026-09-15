export type BrdStoryFields = {
  featureName: string;
  userStory: string;
  businessObjective: string;
  targetUsers: string;
  acceptanceCriteria: string;
  technicalConstraints: string;
};

export const EMPTY_STORY_FIELDS: BrdStoryFields = {
  featureName: "",
  userStory: "",
  businessObjective: "",
  targetUsers: "",
  acceptanceCriteria: "",
  technicalConstraints: "",
};

const FIELD_LABELS: Array<{ key: keyof BrdStoryFields; label: string }> = [
  { key: "featureName", label: "Nama Fitur / Inisiatif" },
  { key: "userStory", label: "User Story Utama" },
  { key: "businessObjective", label: "Tujuan Bisnis" },
  { key: "targetUsers", label: "Target Pengguna" },
  { key: "acceptanceCriteria", label: "Kriteria Keberhasilan Awal" },
  { key: "technicalConstraints", label: "Batasan Teknis / Regulasi" },
];

/**
 * Gabungkan formulir 6 kolom menjadi satu payload user story untuk agen.
 * Kolom opsional yang kosong tidak ikut ditulis agar prompt tetap ringkas.
 */
export function composeUserStory(fields: BrdStoryFields): string {
  return FIELD_LABELS.flatMap(({ key, label }) => {
    const value = fields[key].trim();
    if (!value) return [];
    return [`${label}: ${value}`];
  }).join("\n");
}

/** Balikkan payload hasil compose ke kolom formulir (best effort). */
export function parseUserStory(text: string): BrdStoryFields {
  const fields: BrdStoryFields = { ...EMPTY_STORY_FIELDS };
  if (!text.trim()) return fields;

  const leftovers: string[] = [];
  let matched = false;
  for (const line of text.split("\n")) {
    const entry = FIELD_LABELS.find(({ label }) => line.startsWith(`${label}:`));
    if (!entry) {
      leftovers.push(line);
      continue;
    }
    matched = true;
    const value = line.slice(entry.label.length + 1).trim();
    fields[entry.key] = fields[entry.key] ? `${fields[entry.key]}\n${value}` : value;
  }

  if (!matched) return { ...fields, userStory: text.trim() };

  const rest = leftovers.join("\n").trim();
  if (rest) fields.userStory = fields.userStory ? `${fields.userStory}\n${rest}` : rest;
  return fields;
}
