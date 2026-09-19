import type { UIMessage } from "@anvia/client";

export type SessionBrdSummary = {
  id: string;
  currentVersion: number;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED";
  hasPendingModification: boolean;
};

export type SessionFlowSummary = {
  phase: "CLARIFYING" | "GENERATING";
  round: number;
};

export type SessionSummary = {
  id: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  brd?: SessionBrdSummary | null;
  flow?: SessionFlowSummary | null;
};

export type TemplateSummary = {
  id: string;
  title: string;
  status: "UPLOADING" | "PROCESSING" | "READY" | "PENDING_CONFIRMATION" | "FAILED";
  hasStructure: boolean;
  sectionCount: number;
  error: string | null;
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  templateId: string | null;
  templateTitle: string | null;
  isDefault: boolean;
  sessionCount: number;
  documentCount: number;
  brd: SessionBrdSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentSummary = {
  id: string;
  title: string;
  fileType: "PDF" | "MARKDOWN" | "IMAGE_FLOWCHART" | "DOCX" | "OTHER";
  fileSize: number;
  status: "UPLOADING" | "PROCESSING" | "READY" | "PENDING_CONFIRMATION" | "FAILED";
  storageUrl: string;
  projectId?: string | null;
  sessionId?: string | null;
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
  projectId: string;
  sessionId: string | null;
  title: string;
  currentVersion: number;
  contentMarkdown: string;
  pendingContentMarkdown: string | null;
  pendingChangeSummary: string | null;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED";
  statusBeforePending?: "DRAFT" | "IN_REVIEW" | "APPROVED" | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: BrdVersion[];
};

export type Settings = {
  id: string;
  userId: string;
  theme: "light" | "dark" | "system";
  aiProvider: "openrouter" | "custom";
  aiModel: string | null;
  easyModel: string | null;
  mediumModel: string | null;
  hardModel: string | null;
  customBaseUrl: string | null;
  encryptedApiKey: string | null;
  systemPrompt: string | null;
  activeTemplateId: string | null;
};

export type ModelDefaults = {
  aiModel: string;
  easyModel: string;
  mediumModel: string;
  hardModel: string;
  baseUrl: string;
};

export type SettingsResponse = {
  settings: Settings | null;
  modelDefaults: ModelDefaults;
  hasServerApiKey: boolean;
};

export type SearchResult = {
  type: "brd" | "document";
  id: string;
  title: string;
  projectId: string | null;
  sessionId: string | null;
  status?: string;
  updatedAt: string;
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  purpose?: string;
  options: string[];
  required: boolean;
};

export type MessagesResponse = { messages: UIMessage[] };
