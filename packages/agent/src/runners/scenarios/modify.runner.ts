import { fixtureAdapters } from "../fixtures/adapters.js";
import { Checks, hasApiKey, runAgent, toolOutput, type ScenarioResult } from "../harness.js";

type ModifyOutput = {
  staged?: boolean;
  applied?: number;
  gaps?: string[];
  changeSummary?: string;
};

export const modifyScenario = {
  name: "modify",
  async run(): Promise<ScenarioResult> {
    if (!hasApiKey()) return { name: "modify", status: "skip", assertions: [] };
    const checks = new Checks();
    // Staging direkam seperti adapter API: tool tidak lagi mengembalikan markdown
    // penuh ke model, jadi verifikasi dilakukan pada payload yang distage.
    const staged: string[] = [];
    const adapters = {
      ...fixtureAdapters,
      stageBrdModification: ({ updatedMarkdown }: { updatedMarkdown: string }) => {
        staged.push(updatedMarkdown);
        return { ok: true as const };
      },
    };
    const capture = await runAgent({
      phase: "QA",
      prompt:
        "Ubah FR-002 agar menampilkan status persetujuan beserta riwayat perubahannya, lalu tambahkan requirement baru tentang notifikasi email ke approver saat status berubah.",
      adapters,
    });

    const output = toolOutput<ModifyOutput>(capture, "modify_brd");
    checks.check("memanggil tool modify_brd", Boolean(output));
    checks.check(
      "minimal satu operasi diterapkan",
      (output?.applied ?? 0) >= 1,
      `applied=${output?.applied}`,
    );
    checks.check("preview distage server-side", output?.staged === true);
    const updated = staged.at(-1) ?? "";
    checks.check("FR-002 tidak terduplikasi", (updated.match(/### FR-002/g) ?? []).length === 1);
    checks.check("perubahan FR-002 diterapkan", /status persetujuan|riwayat/i.test(updated));
    checks.check("requirement baru ditambahkan", /notifikasi email/i.test(updated));
    checks.check(
      "tidak ada gap yang dilaporkan",
      (output?.gaps?.length ?? 0) === 0,
      output?.gaps?.join(" "),
    );

    return {
      name: "modify",
      status: checks.ok ? "pass" : "fail",
      assertions: checks.assertions,
      capture: {
        text: capture.text.slice(0, 1500),
        toolCalls: capture.toolCalls.map((call) => ({
          name: call.name,
          output: JSON.stringify(call.output)?.slice(0, 3000),
        })),
      },
    };
  },
};
