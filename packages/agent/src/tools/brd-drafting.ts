import { createTool } from "@anvia/core";
import { z } from "zod";

export const elicitBrdClarificationsTool = createTool({
  name: "elicit_brd_clarifications",
  description: "Identify focused unanswered questions that block a safe BRD draft.",
  inputSchema: z.object({
    userStory: z.string().trim().min(1),
    knownContext: z.string().default(""),
  }),
  execute: async ({ userStory, knownContext }) => ({
    userStory,
    knownContext,
    questions: [],
    status: "ready_for_model_completion" as const,
    rule: "Return only questions whose answers can change scope, behavior, data, security, permissions, or failure handling.",
  }),
});

export const draftBrdTool = createTool({
  name: "draft_brd",
  description: "Prepare a structured BRD only after ambiguity review, using an optional active template.",
  inputSchema: z.object({
    userStory: z.string().trim().min(1),
    referenceContext: z.string().default(""),
    template: z.object({
      name: z.string().trim().min(1),
      sections: z.array(z.string().trim().min(1)).min(1),
      requirementIdPatterns: z.array(z.string().trim().min(1)).default([]),
      requiredMetadata: z.array(z.string().trim().min(1)).default([]),
    }).nullable().default(null),
    clarifications: z.array(z.object({
      question: z.string().trim().min(1),
      answer: z.string().trim().min(1),
    })).default([]),
    unresolvedQuestions: z.array(z.string().trim().min(1)).default([]),
  }),
  execute: async ({ userStory, referenceContext, template, clarifications, unresolvedQuestions }) => ({
    userStory,
    referenceContext,
    template,
    clarifications,
    unresolvedQuestions,
    sections: template?.sections ?? [
      "document_control",
      "summary_and_scope",
      "actors_and_user_journey",
      "business_requirements_and_rules",
      "functional_requirements",
      "non_functional_and_architecture",
      "api_and_data_requirements",
      "acceptance_criteria",
      "traceability_and_review",
    ],
    status: unresolvedQuestions.length > 0 ? "clarification_required" as const : "ready_for_model_completion" as const,
  }),
});
