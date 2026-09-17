import { LangfuseClient } from "@anvia/langfuse";
import { LensClient } from "@anvia/lens";
import type { AgentObserver } from "@anvia/core/observability";

export const TRACING_SERVICE_NAME = "sa-ai-assistant-agent";

export type TracingProvider = "lens" | "langfuse";

/** "safe" hanya metadata; "full" ikut menangkap payload input/output. */
export type TracingCaptureMode = "safe" | "full";

export const DEFAULT_TRACING_CAPTURE_MODE: TracingCaptureMode = "full";

export interface Tracing {
  provider: TracingProvider;
  observers: Record<string, AgentObserver>;
  primaryTrace: string;
  flush(): Promise<void>;
  close(): Promise<void>;
}

function requireEnv(names: string[], provider: TracingProvider): void {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Tracing provider "${provider}" dipilih tetapi env berikut belum di-set: ${missing.join(", ")}`,
    );
  }
}

export interface TracingOptions {
  captureMode?: TracingCaptureMode;
}

export function createTracing(provider: TracingProvider, options: TracingOptions = {}): Tracing {
  const captureMode = options.captureMode ?? DEFAULT_TRACING_CAPTURE_MODE;
  if (provider === "langfuse") {
    requireEnv(["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"], provider);
    const langfuse = new LangfuseClient({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      serviceName: TRACING_SERVICE_NAME,
    });

    return {
      provider,
      observers: { langfuse: langfuse.observer({ captureMode }) },
      primaryTrace: "langfuse",
      flush: () => langfuse.flush(),
      close: () => langfuse.close(),
    };
  }

  requireEnv(["ANVIA_LENS_BASE_URL", "ANVIA_LENS_PUBLIC_KEY", "ANVIA_LENS_SECRET_KEY"], provider);
  const lens = new LensClient({
    optional: true,
    serviceName: process.env.ANVIA_LENS_SERVICE_NAME ?? TRACING_SERVICE_NAME,
    captureMode,
  });

  return {
    provider,
    observers: { lens: lens.observer({ captureMode }) },
    primaryTrace: "lens",
    flush: () => lens.flush(),
    close: () => lens.close(),
  };
}

const shared = new Map<string, Tracing>();

export function tracing(provider: TracingProvider, options: TracingOptions = {}): Tracing {
  const captureMode = options.captureMode ?? DEFAULT_TRACING_CAPTURE_MODE;
  const key = `${provider}:${captureMode}`;
  let instance = shared.get(key);
  if (!instance) {
    instance = createTracing(provider, { captureMode });
    shared.set(key, instance);
  }
  return instance;
}

export async function flushTracing(): Promise<void> {
  await Promise.allSettled([...shared.values()].map((instance) => instance.flush()));
}

export async function closeTracing(): Promise<void> {
  const instances = [...shared.values()];
  shared.clear();
  await Promise.allSettled(instances.map((instance) => instance.close()));
}
