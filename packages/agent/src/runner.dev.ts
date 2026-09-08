/**
 * Runner guide:
 *
 * From packages/agent:
 *   pnpm runner:dev
 *
 * Select a prompt category and prompt index:
 *   PROMPT_CATEGORY=identity PROMPT_INDEX=0 pnpm runner:dev
 *   PROMPT_CATEGORY=research PROMPT_INDEX=1 pnpm runner:dev
 *   PROMPT_CATEGORY=brd PROMPT_INDEX=2 pnpm runner:dev
 *   PROMPT_CATEGORY=general PROMPT_INDEX=0 pnpm runner:dev
 *
 * Run every prompt:
 *   PROMPT_CATEGORY=all pnpm runner:dev
 *
 * Use non-streaming completion mode:
 *   RUNNER_MODE=completion PROMPT_CATEGORY=brd PROMPT_INDEX=0 pnpm runner:dev
 *
 * Prompt indexes are zero-based. Defaults: research, index 0, stream mode.
 */

import { createSystemAnalystAgent } from "./agent.js";

const agent = createSystemAnalystAgent();

const PROMPTS = {
  identity: [
    "Hai, what agent are you?",
    "What model are you?",
    "What tools do you have?",
  ],
  research: [
    "Bisa kah cari informasi tentang Knitto Group?",
    "Find the latest information about Knitto Group and cite your sources.",
  ],
  brd: [
    "Draft a short BRD for a food delivery mobile app.",
    "What questions should I answer before building an appointment booking system?",
    "Modify the BRD to add admin approval before publishing.",
    "Verify this flow: customer submits an order, staff approves it, and the system sends confirmation.",
  ],
  general: ["Draft a short support reply.", "Please summarize the docs."],
} as const;

type PromptCategory = keyof typeof PROMPTS;

const requestedCategory = process.env.PROMPT_CATEGORY ?? "research";
const isAll = requestedCategory === "all";
const category = isAll ? "research" : (requestedCategory as PromptCategory);
const prompts = PROMPTS[category];

if (!isAll && !prompts) {
  throw new Error(
    `Unknown PROMPT_CATEGORY: ${requestedCategory}. ` +
      `Use: ${Object.keys(PROMPTS).join(", ")}, or all`,
  );
}

const promptIndex = Number(process.env.PROMPT_INDEX ?? 0);
const prompt = prompts[promptIndex];

if (!isAll && !prompt) {
  throw new Error(
    `PROMPT_INDEX must be between 0 and ${prompts.length - 1} for ${category}.`,
  );
}

if (!isAll) {
  console.log(
    `\n[${category} ${promptIndex + 1}/${prompts.length}] ${prompt}\n`,
  );
}

const selectedPrompts = isAll
  ? Object.entries(PROMPTS).flatMap(([name, categoryPrompts]) =>
      categoryPrompts.map((value, index) => ({ name, index, value })),
    )
  : [{ name: category, index: promptIndex, value: prompt! }];

async function runPrompt(
  prompt: string,
  mode: "completion" | "stream" = "stream",
) {
  if (mode === "completion") {
    const res = await agent.generate({ prompt });

    if (res.type === "interaction") {
      console.log("Interaction required:", res.interaction.type);
    } else if (res.type === "blocked") {
      console.log("Blocked:", res.stage, res.reason);
    } else {
      console.log(res.output);
    }

    console.log("Usage:", res.usage);
    return;
  }

  for await (const event of agent.stream({ prompt })) {
    if (event.type === "text_delta") {
      process.stdout.write(event.delta);
    } else if (
      event.type === "response" ||
      event.type === "interaction" ||
      event.type === "blocked"
    ) {
      process.stdout.write("\n");
      console.log("Usage:", event.usage);
    } else if (event.type === "error") {
      console.error("Error:", event.error);
    }
  }
}

const mode = process.env.RUNNER_MODE === "completion" ? "completion" : "stream";

for (const item of selectedPrompts) {
  console.log(`\n========== ${item.name} ${item.index + 1} ==========`);
  await runPrompt(item.value, mode);
}
