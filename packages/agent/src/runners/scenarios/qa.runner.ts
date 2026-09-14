import { fixtureAdapters } from "../fixtures/adapters.js";
import { Checks, hasApiKey, runAgent, type ScenarioResult } from "../harness.js";

export const qaScenario = {
  name: "qa",
  async run(): Promise<ScenarioResult> {
    if (!hasApiKey()) return { name: "qa", status: "skip", assertions: [] };
    const checks = new Checks();
    const capture = await runAgent({
      phase: "QA",
      prompt: "Apa isi BR-001 dan apa implikasinya untuk validasi pengajuan?",
      adapters: fixtureAdapters,
    });

    const answer = capture.text.trim();
    checks.check("menjawab pertanyaan", answer.length > 40, `panjang=${answer.length}`);
    checks.check("mengutip BR-001", /BR-001/.test(answer), answer.slice(0, 140));
    checks.check(
      "membahas aturan invoice/pagu",
      /invoice|10 juta|10\.000\.000|pagu/i.test(answer),
      answer.slice(0, 140),
    );
    checks.check(
      "tidak mengeluh tidak punya akses",
      !/tidak (bisa|dapat) (mengakses|membaca)/i.test(answer),
    );

    return {
      name: "qa",
      status: checks.ok ? "pass" : "fail",
      assertions: checks.assertions,
      capture: {
        text: answer.slice(0, 2500),
        toolCalls: capture.toolCalls.map((call) => ({ name: call.name })),
      },
    };
  },
};
