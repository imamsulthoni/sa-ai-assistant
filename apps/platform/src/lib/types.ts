import type { UIMessage } from "@anvia/client";

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type DocumentSummary = {
  id: string;
  title: string;
  fileType: "PDF" | "MARKDOWN" | "IMAGE_FLOWCHART" | "DOCX" | "OTHER";
  fileSize: number;
  status: "UPLOADING" | "PROCESSING" | "READY" | "PENDING_CONFIRMATION" | "FAILED";
  storageUrl: string;
  createdAt: string;
  error: string | null;
};

export type BrdVersion = {
  id: string;
  versionNumber: number;
  contentMarkdown: string;
  changeSummary: string | null;
  createdBy: string;
  createdAt: string;
};

export type BrdDocument = {
  id: string;
  sessionId: string;
  title: string;
  currentVersion: number;
  contentMarkdown: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED";
  createdAt: string;
  updatedAt: string;
  versions?: BrdVersion[];
};

export type Settings = {
  id: string;
  userId: string;
  theme: "light" | "dark" | "system";
  aiProvider: string;
  aiModel: string;
  customBaseUrl: string | null;
  encryptedApiKey: string | null;
  systemPrompt: string | null;
  activeTemplateId: string | null;
};

export type SearchResult = {
  type: "brd" | "document";
  id: string;
  title: string;
  sessionId: string | null;
  status?: string;
  updatedAt: string;
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  options: string[];
  required: boolean;
};

export type BrdFlowResponse =
  | {
      phase: "CLARIFYING";
      round: number;
      clarification_questions: ClarificationQuestion[];
      missing: string[];
    }
  | {
      phase: "GENERATING";
      round: number;
      markdown: string;
      assumptions: string[];
      traceability: Array<Record<string, string>>;
      context: string;
    };

export type BrdModificationResponse = {
  updatedMarkdown: string;
  changeSummary: string;
  affectedIds: string[];
  groundedByReference: boolean;
  persisted: false;
};

export type MessagesResponse = { messages: UIMessage[] };
