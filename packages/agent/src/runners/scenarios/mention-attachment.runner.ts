import { extractBrdDocument, templateInstructionBlock } from "../../index.js";
import { fixtureAdapters } from "../fixtures/adapters.js";
import { attachmentBlockFor, REFERENCE_DOC, referenceDocSearchResults } from "../fixtures/attachment.js";
import { COMPLETE_ANSWERS, PAYMENT_STORY, ROUND2_ANSWERS } from "../fixtures/stories.js";
import { TEMPLATE } from "../fixtures/template.js";
import { Checks, hasApiKey, runAgent, type ScenarioResult } from "../harness.js";

const question = `Berdasarkan dokumen ${REFERENCE_DOC.title} yang saya mention: apakah BRD hasil generate sudah memuat SLA pembayaran 5 hari kerja dan notifikasi email ke approver saat status berubah? Sebutkan bagian BRD yang sudah sesuai dan bagian yang masih perlu ditambahkan.`;

export const mentionAttachmentScenario = {
  name: "mention-attachment",
  async run(): Promise<ScenarioResult> {
    if (!hasApiKey()) return { name: "mention-attachment", status: "skip", assertions: [] };
    const checks = new Checks();

    // 1) GENERATE — BRD hasil generate memakai dokumen referensi yang sama
    // dengan yang nanti di-mention di chat.
    const referenceContext = REFERENCE_DOC.pages
      .map((page) => `[${REFERENCE_DOC.title} halaman ${page.pageNumber}] ${page.content}`)
      .join("\n");
    const generate = await runAgent({
      phase: "GENERATE",
      prompt: [
        `User story (data): ${PAYMENT_STORY}`,
        `Answers (data): ${JSON.stringify({ ...COMPLETE_ANSWERS, ...ROUND2_ANSWERS })}`,
        `Reference context (data): ${referenceContext}`,
        `TEMPLATE AKTIF (WAJIB DIIKUTI):\n${templateInstructionBlock(TEMPLATE)}`,
        "Generate BRD lengkap berbahasa Indonesia dengan flowchart mermaid. force: true",
      ].join("\n\n"),
      adapters: fixtureAdapters,
    });
    const markdown = extractBrdDocument(generate.text);
    checks.check(
      "1. BRD hasil generate siap ditanya",
      markdown.startsWith("# BRD") && markdown.length > 800 && /```mermaid/.test(markdown),
      `panjang=${markdown.length}`,
    );

    // 2) MENTION + QA — prompt dibentuk seperti chat router: pertanyaan user
    // digabung dengan blok konten dokumen yang di-mention.
    const stagedMarkdown: string[] = [];
    const mentionAdapters = {
      ...fixtureAdapters,
      searchContext: () => referenceDocSearchResults(),
      getActiveBrd: () => ({ contentMarkdown: markdown, versions: [] }),
      stageBrdModification: ({ updatedMarkdown }: { updatedMarkdown: string }) => {
        stagedMarkdown.push(updatedMarkdown);
        return { ok: true as const };
      },
    };
    const qa = await runAgent({
      phase: "QA",
      prompt: `${question}\n\n${attachmentBlockFor(REFERENCE_DOC)}`,
      adapters: mentionAdapters,
    });
    const answer = qa.text.trim();

    checks.check("2. menjawab pertanyaan", answer.length > 120, `panjang=${answer.length}`);
    checks.check(
      "2. memakai isi dokumen yang di-mention",
      /sla|5 hari kerja/i.test(answer) && /notifikasi/i.test(answer),
      answer.slice(0, 200),
    );
    checks.check(
      "2. tidak menolak akses dokumen",
      !/tidak (bisa|dapat) (mengakses|membaca)|tidak punya akses|tidak memiliki akses/i.test(answer),
      answer.slice(0, 200),
    );
    checks.check(
      "2. jawaban dikaitkan dengan BRD",
      /(?:FR|BR)-\d{3}|\bBRD\b/i.test(answer),
      answer.slice(0, 200),
    );

    // 3) Kalau agent memilih memodifikasi BRD, konten lama tidak boleh hilang.
    const updated = stagedMarkdown.at(-1);
    if (updated) {
      checks.check(
        "3. modifikasi mempertahankan identifier lama",
        /(?:FR|BR)-\d{3}/.test(updated) && /sla|notifikasi/i.test(updated),
        `panjang=${updated.length}`,
      );
    }

    return {
      name: "mention-attachment",
      status: checks.ok ? "pass" : "fail",
      assertions: checks.assertions,
      capture: {
        text: answer.slice(0, 2500),
        toolCalls: qa.toolCalls.map((call) => ({ name: call.name })),
      },
    };
  },
};
