import { LangfuseClient } from "@anvia/langfuse";
import type { AgentObserver } from "@anvia/core/observability";

export interface LangfuseTracing {
  observer?: AgentObserver;
  flush(): Promise<void>;
}

export function createTracing(): LangfuseTracing {
  const enabled = Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  const langfuse = new LangfuseClient({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
    serviceName: "sa-ai-assistant-agent",
  });

  return {
    observer: enabled ? langfuse.observer({ captureMode: "safe" }) : undefined,
    async flush() {
      await langfuse.flush();
    },
  };
}
