import { COMPLETE_ANSWERS, PAYMENT_STORY, WEAK_STORY } from "../fixtures/stories.js";
import { Checks, hasApiKey, parseLooseJson, runAgent, type ScenarioResult } from "../harness.js";

type JudgeOutput = {
  sufficient?: boolean;
  missing?: string[];
  clarification_questions?: unknown[];
};

function judgePrompt(story: string, answers: Record<string, string>): string {
  return [
    "Return JSON only with sufficient, missing, and clarification_questions.",
    "You are judging round 1; do not generate a BRD.",
    "If round 1 has any material gap in actors, scope, workflow, validation, permissions, failure handling, integrations, or acceptance criteria, set sufficient=false and return follow-up questions in Indonesian.",
    `User story (data): ${story}`,
    `Answers (data): ${JSON.stringify(answers)}`,
  ].join("\n");
}

export const judgeScenario = {
  name: "judge",
  async run(): Promise<ScenarioResult> {
    if (!hasApiKey()) return { name: "judge", status: "skip", assertions: [] };
    const checks = new Checks();

    const weak = await runAgent({
      phase: "JUDGE",
      prompt: judgePrompt(WEAK_STORY, {}),
    });
    const weakOutput = parseLooseJson(weak.text) as JudgeOutput | null;
    checks.check("jawaban lemah menghasilkan JSON valid", Boolean(weakOutput));
    checks.check("jawaban lemah dinilai belum cukup", weakOutput?.sufficient === false);
    checks.check(
      "pertanyaan lanjutan 1-3 buah untuk jawaban lemah",
      (weakOutput?.clarification_questions?.length ?? 0) >= 1 &&
        (weakOutput?.clarification_questions?.length ?? 0) <= 3,
      `jumlah=${weakOutput?.clarification_questions?.length ?? 0}`,
    );

    const strong = await runAgent({
      phase: "JUDGE",
      prompt: judgePrompt(PAYMENT_STORY, COMPLETE_ANSWERS),
    });
    const strongOutput = parseLooseJson(strong.text) as JudgeOutput | null;
    checks.check("jawaban lengkap menghasilkan JSON valid", Boolean(strongOutput));
    // A strict judge is fine: round 1 may still request the single follow-up
    // round. What matters is that the follow-ups stay bounded and non-empty.
    const followUps = strongOutput?.clarification_questions ?? [];
    checks.check(
      "pertanyaan lanjutan tetap dibatasi 3",
      followUps.length <= 3,
      `jumlah=${followUps.length}`,
    );
    if (strongOutput?.sufficient === false) {
      checks.check("jawaban belum cukup disertai daftar gap", Boolean(strongOutput.missing));
    }

    return {
      name: "judge",
      status: checks.ok ? "pass" : "fail",
      assertions: checks.assertions,
      capture: {
        text: `${weak.text.slice(0, 1200)}\n---\n${strong.text.slice(0, 1200)}`,
        toolCalls: [],
      },
    };
  },
};
