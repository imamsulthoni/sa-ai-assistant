import { Hono } from "hono";
import { normalizeTemplateStructure } from "@sa-ai-assistant/agent";
import { USER_ID_HEADER, CONVERSATION_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { SettingsPatchSchema, TemplateManualCreateSchema } from "../../lib/api-contract.js";
import {
  MAX_DOCUMENT_SIZE,
  DOCUMENT_MIME_TYPES,
  UploadDocumentSchema,
} from "../document/schema.js";
import {
  approveTemplate,
  createManualTemplate,
  enqueueTemplateProcess,
  getCurrentTemplate,
  getSettings,
  getTemplate,
  hasServerApiKey,
  modelDefaults,
  patchSettings,
  patchTemplateStructure,
  rejectTemplate,
  resetActiveTemplate,
  uploadTemplate,
} from "./services.js";

const user = (c: { req: { header(name: string): string | undefined } }) =>
  resolveUserId(c.req.header(USER_ID_HEADER));

export const settingsModule = new Hono()
  .get("/", async (c) =>
    c.json({
      settings: await getSettings(user(c)),
      modelDefaults: modelDefaults(),
      hasServerApiKey: hasServerApiKey(),
    }),
  )
  .patch("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SettingsPatchSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Invalid settings payload", issues: parsed.error.issues }, 400);
    return c.json({ settings: await patchSettings(user(c), parsed.data) });
  })
  .post("/template", async (c) => {
    const form = await c.req.formData();
    const parsed = UploadDocumentSchema.safeParse({ file: form.get("file") });
    if (!parsed.success) return c.json({ error: "A file is required" }, 400);
    const file = parsed.data.file;
    if (file.size > MAX_DOCUMENT_SIZE || (file.type && !DOCUMENT_MIME_TYPES.has(file.type)))
      return c.json({ error: "Unsupported or oversized file" }, 415);
    const owner = user(c);
    const document = await uploadTemplate(
      owner,
      c.req.header(CONVERSATION_ID_HEADER)?.trim(),
      file,
    );
    if (!(await enqueueTemplateProcess(document.id, document.objectKey))) {
      return c.json({ error: "Failed to enqueue template" }, 503);
    }
    return c.json({ document }, 201);
  })
  .post("/template/manual", async (c) => {
    const parsed = TemplateManualCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Invalid manual template payload", issues: parsed.error.issues }, 400);
    }
    const normalized = normalizeTemplateStructure(parsed.data.templateStructure);
    if (!normalized) return c.json({ error: "Invalid template structure" }, 400);
    const document = await createManualTemplate(user(c), {
      title: parsed.data.title,
      templateStructure: normalized,
    });
    return c.json({ document }, 201);
  })
  // Registered before "/template/:id" so the literal path is not swallowed.
  .get("/template", async (c) => c.json(await getCurrentTemplate(user(c))))
  .get("/template/:id", async (c) => {
    const document = await getTemplate(user(c), c.req.param("id"));
    return document ? c.json({ document }) : c.json({ error: "Template not found" }, 404);
  })
  .patch("/template/:id", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { templateStructure?: unknown } | null;
    if (!body || body.templateStructure === undefined) {
      return c.json({ error: "templateStructure is required" }, 400);
    }
    const normalized = normalizeTemplateStructure(body.templateStructure);
    if (!normalized) return c.json({ error: "Invalid template structure" }, 400);
    const owner = user(c);
    if (!(await patchTemplateStructure(owner, c.req.param("id"), normalized))) {
      return c.json({ error: "Template not found" }, 404);
    }
    const document = await getTemplate(owner, c.req.param("id"));
    return document ? c.json({ document }) : c.json({ error: "Template not found" }, 404);
  })
  .post("/template/:id/approve", async (c) => {
    const id = await approveTemplate(user(c), c.req.param("id"));
    if (!id) return c.json({ error: "Template not found" }, 404);
    return c.json({ ok: true, activeTemplateId: id });
  })
  .post("/template/:id/reject", async (c) => {
    const ok = await rejectTemplate(user(c), c.req.param("id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "Template not found" }, 404);
  })
  .post("/template/reset", async (c) => c.json({ ok: await resetActiveTemplate(user(c)) }));
