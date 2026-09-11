import { generateCompletion } from "@anvia/core";
import type { OpenAICompletionModel } from "@anvia/openai";
import { z } from "zod";

export const ClarificationGateSchema = z.object({
  sufficient: z.boolean(),
  missing: z.array(z.string()).max(3),
});
export type ClarificationGateResult = z.infer<typeof ClarificationGateSchema>;

export function clarificationGateHeuristically(
  userStory: string,
  answers: readonly string[],
  round: number,
): ClarificationGateResult {
  if (round >= 2) return { sufficient: true, missing: [] };
  const missing: string[] = [];
  if (!/(actor|user|customer|admin|staff)/i.test(`${userStory} ${answers.join(" ")}`))
    missing.push("aktor dan otorisasi");
  if (!/(when|if|jika|gagal|error|timeout|limit|batas)/i.test(`${userStory} ${answers.join(" ")}`))
    missing.push("aturan validasi dan skenario gagal");
  return { sufficient: missing.length === 0, missing: missing.slice(0, 3) };
}

export async function clarificationGate(
  model: OpenAICompletionModel,
  userStory: string,
  answers: readonly string[],
  round: number,
) {
  return (
    await generateCompletion({
      model,
      instructions:
        "Assess whether enough business detail exists to draft a BRD. Return only the schema.",
      prompt: `User story:\n${userStory}\nAnswers:\n${answers.join("\n")}\nRound: ${round}`,
      outputSchema: ClarificationGateSchema,
    })
  ).output;
}
