import { templateInstructionBlock } from "../../index.js";
import { fixtureAdapters } from "../fixtures/adapters.js";
import { PAYMENT_STORY } from "../fixtures/stories.js";
import { TEMPLATE } from "../fixtures/template.js";
import { Checks, hasApiKey, runAgent, toolOutput, type ScenarioResult } from "../harness.js";

type ClarifyOutput = {
  clarification_questions: Array<{
    id: string;
    question: string;
    options?: string[];
    required?: boolean;
  }>;
  round: number;
  capped: boolean;
};

export const clarifyScenario = {
  name: "clarify",
  async run(): Promise<ScenarioResult> {
    if (!hasApiKey()) return { name: "clarify", status: "skip", assertions: [] };
    const checks = new Checks();
    const capture = await runAgent({
      phase: "CLARIFY",
      prompt: [
        "Round: 1",
        `User story (data):\n${PAYMENT_STORY}`,
        "Prior answers (data):\n{}",
        `TEMPLATE AKTIF (gunakan untuk memilih pertanyaan yang mengisi section wajib):\n${templateInstructionBlock(TEMPLATE)}`,
      ].join("\n\n"),
      adapters: fixtureAdapters,
    });

    const output = toolOutput<ClarifyOutput>(capture, "elicit_clarifications");
    checks.check("memanggil tool elicit_clarifications", Boolean(output));
    const questions = output?.clarification_questions ?? [];
    checks.check(
      "menghasilkan 1-3 pertanyaan",
      questions.length >= 1 && questions.length <= 3,
      `jumlah=${questions.length}`,
    );
    checks.check(
      "id pertanyaan berformat q1_n",
      questions.every((question) => /^q1_\d+$/.test(question.id)),
      questions.map((question) => question.id).join(", "),
    );
    checks.check(
      "pertanyaan berbahasa Indonesia",
      questions.every((question) =>
        /apa|bagaimana|siapa|kapan|apakah|mana|berapa/i.test(question.question),
      ),
      questions
        .map((question) => question.question)
        .join(" | ")
        .slice(0, 160),
    );
    checks.check(
      "opsi jawaban tidak lebih dari 5",
      questions.every((question) => (question.options?.length ?? 0) <= 5),
    );

    return {
      name: "clarify",
      status: checks.ok ? "pass" : "fail",
      assertions: checks.assertions,
      capture: {
        text: capture.text.slice(0, 2000),
        toolCalls: capture.toolCalls.map((call) => ({
          name: call.name,
          output: JSON.stringify(call.output)?.slice(0, 2000),
        })),
      },
    };
  },
};
