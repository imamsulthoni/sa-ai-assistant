import { dumpArtifact, hasApiKey, type Scenario, type ScenarioResult } from "./harness.js";
import { clarifyScenario } from "./scenarios/clarify.runner.js";
import { fullFlowScenario } from "./scenarios/full-flow.runner.js";
import { generateScenario } from "./scenarios/generate.runner.js";
import { injectionScenario } from "./scenarios/injection.runner.js";
import { judgeScenario } from "./scenarios/judge.runner.js";
import { modifyScenario } from "./scenarios/modify.runner.js";
import { qaScenario } from "./scenarios/qa.runner.js";

const SCENARIOS: Scenario[] = [
  clarifyScenario,
  judgeScenario,
  generateScenario,
  modifyScenario,
  qaScenario,
  injectionScenario,
  fullFlowScenario,
];

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((arg) => arg.startsWith("--"));
  const verbose = flags.includes("--verbose");
  const requireEnv = flags.includes("--require-env");

  if (flags.includes("--list")) {
    console.log(SCENARIOS.map((scenario) => scenario.name).join("\n"));
    return;
  }

  const requested = args.find((arg) => !arg.startsWith("--")) ?? "all";
  const selected =
    requested === "all" ? SCENARIOS : SCENARIOS.filter((scenario) => scenario.name === requested);
  if (selected.length === 0) {
    console.error(`Scenario tidak dikenal: ${requested}`);
    console.error(`Pilihan: all, ${SCENARIOS.map((scenario) => scenario.name).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (!hasApiKey()) {
    console.log("OPENAI_API_KEY tidak ditemukan — runner dilewati.");
    if (requireEnv) process.exitCode = 1;
    return;
  }

  let failures = 0;
  let skips = 0;
  for (const scenario of selected) {
    process.stdout.write(`\n▶ ${scenario.name}\n`);
    let result: ScenarioResult;
    try {
      result = await scenario.run();
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR: ${message}`);
      dumpArtifact({ name: scenario.name, status: "fail", assertions: [], error: message });
      continue;
    }

    if (result.status === "skip") {
      skips += 1;
      console.log("  SKIP");
      continue;
    }

    for (const assertion of result.assertions) {
      if (assertion.ok) {
        if (verbose) console.log(`  ✓ ${assertion.label}`);
      } else {
        console.log(`  ✗ ${assertion.label}${assertion.detail ? ` — ${assertion.detail}` : ""}`);
      }
    }
    if (result.status === "pass") {
      console.log(`  PASS (${result.assertions.length} assertion)`);
    } else {
      failures += 1;
      console.log("  FAIL");
    }
    console.log(`  artifact: ${dumpArtifact(result)}`);
  }

  const passed = selected.length - failures - skips;
  console.log(`\nRingkasan: ${passed} pass · ${failures} fail · ${skips} skip`);
  if (failures > 0) process.exitCode = 1;
}

await main();
