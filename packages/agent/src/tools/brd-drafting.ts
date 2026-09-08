import { createTool } from "@anvia/core";
import { z } from "zod";

export const draftBrdTool = createTool({
  name: "draft_brd",
  description: "Prepare a structured BRD outline from a user story and reference context.",
  inputSchema: z.object({
    userStory: z.string().min(1),
    referenceContext: z.string().default(""),
  }),
  execute: async ({ userStory, referenceContext }) => ({
    userStory,
    referenceContext,
    sections: [
      "summary_and_scope",
      "actors_and_user_journey",
      "business_requirements_and_rules",
      "functional_requirements",
      "api_and_data_requirements",
      "screen_and_wireframe_specifications",
      "acceptance_criteria",
      "risks_assumptions_and_open_questions",
    ],
    status: "ready_for_model_completion" as const,
  }),
});
