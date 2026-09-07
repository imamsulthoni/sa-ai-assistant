import { LensClient } from "@anvia/lens";

export function createTracing() {
  const enabled = process.env.ANVIA_LENS_ENABLED === "true";
  const lens = new LensClient({
    optional: !enabled,
    secretKey: process.env.ANVIA_LENS_SECRET_KEY,
    publicKey: process.env.ANVIA_LENS_PUBLIC_KEY,
    baseUrl: process.env.ANVIA_LENS_BASE_URL,
    serviceName: "sa-ai-assistant-agent",
  });

  return {
    lens,
    observer: enabled ? lens.observer({ captureMode: "safe" }) : undefined,
    async flush() {
      await lens.flush();
    },
  };
}
