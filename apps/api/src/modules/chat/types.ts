export type AgentPhase = "CLARIFY" | "GENERATE" | "QA";

export type FlowMetadata = {
  phase?: AgentPhase;
  brdDocumentId?: string;
};

export type FlowRequest = {
  userStory: string;
  answers?: Record<string, string>;
  round?: number;
  referenceContext?: string;
};
