import { createSystemAnalystAgent } from "./agent.js";

const PROMPTS = [
  "Hai, what agent are you?",
  "What model are you?",
  "What tools do you have?",
  "cari tau tentang company Knitto Group?",
  "cari tau tentang 9 Router?",
  "Cek dokumentasi ACP cursor, gimana cara pakai untuk zed editor, bisa cek disini juga https://cursor.com/docs/cli/acp",
  "Draft a short support reply.",
  "Please summarize the docs.",
];

const agent = createSystemAnalystAgent({
  modelRouter: {
    easyModelId: "gpt-4o-mini",
    mediumModelId: "gpt-4o",
    hardModelId: "gpt-5.2",
    routerModelId: "gpt-4o-mini",
  },
  debugModelRouter: true,
});
// ========== Completion ==========
// const res = await agent.generate({ prompt: PROMPTS[3]! });

// if (res.type === "interaction")
//   throw new Error(`Interaction required: ${res.interaction.type}`);
// if (res.type === "blocked")
//   throw new Error(`Blocked at ${res.stage}: ${res.reason}`);

// console.log({
//   output: res.output,
//   usage: res.usage,
// });

// ========== Stream ==========
for await (const event of agent.stream({
  prompt: "Help me to find information about Knitto Group",
})) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  }

  if (event.type === "generation_start") {
    console.log(`\n[generation_start] turn=${event.turn} modelInfo=`, event.modelInfo);
  }

  if (event.type === "tool_call") {
    console.log("tool call: ", event.toolCall);
  }

  if (
    event.type === "response" ||
    event.type === "interaction" ||
    event.type === "blocked"
  ) {
    process.stdout.write("\n");
    console.log(event.usage);
  }


  if (event.type === "error") {
    process.stdout.write("\n");
    console.error(event.error);
  }
}
