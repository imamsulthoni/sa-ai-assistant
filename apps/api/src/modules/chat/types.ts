export type AgentPhase = "CLARIFY" | "JUDGE" | "GENERATE" | "QA";

export type FlowMetadata = {
  phase?: AgentPhase;
  brdDocumentId?: string;
  round?: number;
  answers?: Record<string, string>;
  force?: boolean;
  attachedFiles?: string[];
  attachedDocumentIds?: string[];
};
