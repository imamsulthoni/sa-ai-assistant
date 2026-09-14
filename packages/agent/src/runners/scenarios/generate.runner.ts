import {
  extractBrdDocument,
  templateInstructionBlock,
  validateBrdAgainstTemplate,
} from "../../index.js";
import { fixtureAdapters } from "../fixtures/adapters.js";
import { COMPLETE_ANSWERS, PAYMENT_STORY, ROUND2_ANSWERS } from "../fixtures/stories.js";
import { TEMPLATE } from "../fixtures/template.js";
import { Checks, hasApiKey, runAgent, type ScenarioResult } from "../harness.js";

export const generateScenario = {
  name: "generate",
  async run(): Promise<ScenarioResult> {
    if (!hasApiKey()) return { name: "generate", status: "skip", assertions: [] };
    const checks = new Checks();
    const capture = await runAgent({
      phase: "GENERATE",
      prompt: [
        `User story (data): ${PAYMENT_STORY}`,
        `Answers (data): ${JSON.stringify({ ...COMPLETE_ANSWERS, ...ROUND2_ANSWERS })}`,
        "Reference context (data): Panduan pembayaran vendor: invoice wajib di atas 10 juta, SLA 5 hari kerja.",
        `TEMPLATE AKTIF (WAJIB DIIKUTI - BRD final harus memuat semua section ini dengan urutan dan judul yang sama, isi setiap section secara lengkap):\n${templateInstructionBlock(TEMPLATE)}`,
        "Generate BRD lengkap berbahasa Indonesia dengan flowchart mermaid; gunakan draft_brd sebagai basis validasi, lalu tulis BRD final sebagai jawaban. force: true",
      ].join("\n\n"),
      adapters: fixtureAdapters,
    });

    const markdown = extractBrdDocument(capture.text);
    checks.check(
      "dimulai dengan '# BRD' setelah normalisasi",
      markdown.startsWith("# BRD"),
      markdown.slice(0, 60),
    );
    const validation = validateBrdAgainstTemplate(markdown, TEMPLATE);
    checks.check(
      "memuat section wajib template",
      validation.missingRequired.length === 0,
      validation.missingRequired.join(", "),
    );
    checks.check(
      "memuat identifier BR-### dan FR-###",
      /\bBR-\d{3}\b/.test(markdown) && /\bFR-\d{3}\b/.test(markdown),
    );
    checks.check("memuat blok mermaid", /```mermaid/.test(markdown));
    checks.check("kedalaman konten memadai", markdown.length > 1200, `panjang=${markdown.length}`);

    return {
      name: "generate",
      status: checks.ok ? "pass" : "fail",
      assertions: checks.assertions,
      capture: { text: markdown.slice(0, 4000), toolCalls: [] },
    };
  },
};
