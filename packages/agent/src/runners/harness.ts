import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSystemAnalystAgent,
  type AgentContextAdapters,
  type AgentPhaseName,
  type TracingCaptureMode,
  type TracingProvider,
} from "../index.js";

export type AgentCapture = {
  text: string;
  toolCalls: Array<{ name: string; output?: unknown }>;
};

let tracingProvider: TracingProvider | null = null;
let tracingCaptureMode: TracingCaptureMode | null = null;

export function configureRunner(
  options: { tracing?: TracingProvider | null; captureMode?: TracingCaptureMode | null } = {},
): void {
  tracingProvider = options.tracing ?? null;
  tracingCaptureMode = options.captureMode ?? null;
}

export type ScenarioResult = {
  name: string;
  status: "pass" | "fail" | "skip";
  assertions: Array<{ label: string; ok: boolean; detail?: string }>;
  capture?: AgentCapture;
  error?: string;
};

export type Scenario = {
  name: string;
  run: () => Promise<ScenarioResult>;
};

export class Checks {
  readonly assertions: ScenarioResult["assertions"] = [];

  check(label: string, ok: boolean, detail?: string): boolean {
    this.assertions.push({ label, ok, detail: ok ? undefined : detail });
    return ok;
  }

  get ok(): boolean {
    return this.assertions.every((assertion) => assertion.ok);
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function runAgent(input: {
  phase?: AgentPhaseName;
  prompt: string;
  adapters?: AgentContextAdapters;
  systemPrompt?: string;
  templateInstruction?: string;
}): Promise<AgentCapture> {
  const agent = createSystemAnalystAgent({
    phase: input.phase,
    contextAdapters: input.adapters,
    systemPrompt: input.systemPrompt,
    templateInstruction: input.templateInstruction,
    tracingBy: tracingProvider,
    tracingCaptureMode: tracingCaptureMode,
  });
  const capture: AgentCapture = { text: "", toolCalls: [] };
  for await (const event of agent.stream({
    prompt: { role: "user", content: input.prompt },
  })) {
    if (event.type === "text_delta") capture.text += event.delta ?? "";
    if (event.type === "tool_result") {
      capture.toolCalls.push({
        name: event.toolName ?? "unknown",
        output: event.output?.type === "json" ? event.output.value : undefined,
      });
    }
  }
  return capture;
}

export function toolOutput<T>(capture: AgentCapture, toolName: string): T | undefined {
  return capture.toolCalls.find((call) => call.name === toolName)?.output as T | undefined;
}

/** Tolerate markdown fences and surrounding prose around agent JSON. */
export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function dumpArtifact(result: ScenarioResult): string {
  const directory = fileURLToPath(new URL("../../runners/.artifacts", import.meta.url));
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `${result.name}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  return file;
}
