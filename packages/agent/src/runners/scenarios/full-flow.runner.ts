import { extractBrdDocument, templateInstructionBlock } from "../../index.js";
import { fixtureAdapters } from "../fixtures/adapters.js";
import { COMPLETE_ANSWERS, PAYMENT_STORY, ROUND2_ANSWERS } from "../fixtures/stories.js";
import { TEMPLATE } from "../fixtures/template.js";
import { Checks, hasApiKey, runAgent, toolOutput, type ScenarioResult } from "../harness.js";

type ClarifyOutput = {
  clarification_questions: Array<{ id: string; question: string }>;
};

type ModifyOutput = {
  updatedMarkdown?: string | null;
  applied?: number;
};

export const fullFlowScenario = {
  name: "full-flow",
  async run(): Promise<ScenarioResult> {
    if (!hasApiKey()) return { name: "full-flow", status: "skip", assertions: [] };
    const checks = new Checks();

    // 1) CLARIFY — pertanyaan dibatasi dan berformat stabil.
    const clarify = await runAgent({
      phase: "CLARIFY",
      prompt: [
        "Round: 1",
        `User story (data):\n${PAYMENT_STORY}`,
        "Prior answers (data):\n{}",
        `TEMPLATE AKTIF:\n${templateInstructionBlock(TEMPLATE)}`,
      ].join("\n\n"),
      adapters: fixtureAdapters,
    });
    const questions =
      toolOutput<ClarifyOutput>(clarify, "elicit_clarifications")?.clarification_questions ?? [];
    checks.check(
      "1. klarifikasi menghasilkan pertanyaan",
      questions.length > 0,
      `jumlah=${questions.length}`,
    );

    // 2) GENERATE — BRD lengkap dengan section wajib dan diagram.
    const generate = await runAgent({
      phase: "GENERATE",
      prompt: [
        `User story (data): ${PAYMENT_STORY}`,
        `Answers (data): ${JSON.stringify({ ...COMPLETE_ANSWERS, ...ROUND2_ANSWERS })}`,
        "Reference context (data): Panduan pembayaran vendor: invoice wajib di atas 10 juta.",
        `TEMPLATE AKTIF (WAJIB DIIKUTI):\n${templateInstructionBlock(TEMPLATE)}`,
        "Generate BRD lengkap berbahasa Indonesia dengan flowchart mermaid. force: true",
      ].join("\n\n"),
      adapters: fixtureAdapters,
    });
    const markdown = extractBrdDocument(generate.text);
    checks.check(
      "2. BRD dihasilkan lengkap",
      markdown.startsWith("# BRD") && markdown.length > 800,
      `panjang=${markdown.length}`,
    );
    checks.check("2. BRD memuat mermaid", /```mermaid/.test(markdown));

    // 3) MODIFY — perubahan pada BRD hasil generate tidak merusak konten lama.
    const generatedAdapters = {
      ...fixtureAdapters,
      getActiveBrd: () => ({ contentMarkdown: markdown, versions: [] }),
    };
    const modify = await runAgent({
      phase: "QA",
      prompt:
        "Tambahkan requirement baru tentang notifikasi email ke approver saat status pengajuan berubah, dan jangan mengubah requirement lain.",
      adapters: generatedAdapters,
    });
    const output = toolOutput<ModifyOutput>(modify, "modify_brd");
    const updated = output?.updatedMarkdown ?? "";
    checks.check(
      "3. modifikasi diterapkan",
      (output?.applied ?? 0) >= 1,
      `applied=${output?.applied}`,
    );
    checks.check("3. konten lama tetap ada", /BR-001/.test(updated) && /FR-001/.test(updated));
    const requirementIds = [...updated.matchAll(/###\s+((?:FR|BR)-\d+)/g)].map((match) => match[1]);
    checks.check(
      "3. tidak ada identifier duplikat",
      new Set(requirementIds).size === requirementIds.length,
      requirementIds.join(", "),
    );

    // 4) APPROVE — mensimulasikan penyimpanan pending preview sebagai versi aktif.
    checks.check(
      "4. kandidat versi siap diekspor",
      updated.length > 500,
      `panjang=${updated.length}`,
    );
    checks.check("4. dokumen hasil akhir memuat identifier", /\b(?:FR|BR)-\d{3}\b/.test(updated));

    return {
      name: "full-flow",
      status: checks.ok ? "pass" : "fail",
      assertions: checks.assertions,
      capture: {
        text: `Q=${questions.length}; BRD=${markdown.length}; updated=${updated.length}`,
        toolCalls: [],
      },
    };
  },
};
