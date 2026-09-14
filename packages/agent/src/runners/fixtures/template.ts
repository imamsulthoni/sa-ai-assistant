import type { BrdTemplateStructure } from "../../index.js";

export const TEMPLATE: BrdTemplateStructure = {
  sections: [
    {
      id: "ringkasan_ruang_lingkup",
      title: "Ringkasan dan ruang lingkup",
      required: true,
      purpose: "Masalah bisnis, tujuan, in-scope, out-of-scope, dan kriteria keberhasilan.",
      order: 1,
    },
    {
      id: "aktor_dan_alur",
      title: "Aktor dan alur pengguna",
      required: true,
      purpose: "Aktor, permission, trigger, main flow, alternate flow, dan exception flow.",
      order: 2,
    },
    {
      id: "kebutuhan_bisnis",
      title: "Kebutuhan bisnis dan aturan",
      required: true,
      purpose: "Aturan bisnis dengan identitas BR-###.",
      order: 3,
    },
    {
      id: "kebutuhan_fungsional",
      title: "Kebutuhan fungsional",
      required: true,
      purpose: "Perilaku sistem yang dapat diamati dengan identitas FR-###.",
      order: 4,
    },
    {
      id: "kriteria_penerimaan",
      title: "Kriteria penerimaan",
      required: true,
      purpose: "Skenario Given/When/Then yang dapat diuji.",
      order: 5,
    },
    {
      id: "lampiran",
      title: "Lampiran",
      required: false,
      purpose: "Referensi tambahan.",
      order: 6,
    },
  ],
  idConventions: ["BR-\\d{3}", "FR-\\d{3}"],
  language: "id",
  acceptanceStyle: "Given/When/Then",
  metadata: {
    templateName: "Template BRD Perusahaan",
    description: null,
    sourceFormat: "markdown",
  },
};
