import { useEffect, useState } from "react";
import { Check, Save, Settings as SettingsIcon, Upload, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
import {
  approveTemplate,
  getTemplate,
  rejectTemplate,
  updateTemplateStructure,
  uploadTemplate,
  type DocumentSummary,
  type Settings,
} from "#/lib/api";
import { useSettings } from "#/modules/settings/hooks/use-settings";

type TemplateStatus = DocumentSummary & {
  templateStructure?: unknown;
  error: string | null;
};

const TRANSIENT_STATUSES = new Set(["UPLOADING", "PROCESSING"]);

function applyTheme(theme: string | undefined) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme !== "light" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SettingsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
        >
          <SettingsIcon size={16} /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] max-w-2xl gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            AI model &amp; credentials are provided and managed by the server — shown below for info
            only and cannot be changed here.
          </DialogDescription>
        </DialogHeader>
        <SettingsContent />
      </DialogContent>
    </Dialog>
  );
}

export function SettingsContent() {
  const { settings, loading, saving, error: settingsError, save, refresh } = useSettings();
  const [form, setForm] = useState<Partial<Settings> & { apiKey?: string }>({});
  const [template, setTemplate] = useState<TemplateStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [structureText, setStructureText] = useState("");

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    applyTheme(form.theme ?? settings?.theme);
  }, [form.theme, settings?.theme]);

  // Poll while the template worker is still extracting.
  useEffect(() => {
    if (!template || !TRANSIENT_STATUSES.has(template.status)) return;
    const timer = window.setInterval(() => {
      void getTemplate(template.id).then(
        (response) => setTemplate(response.document as TemplateStatus),
        () => undefined,
      );
    }, 2000);
    return () => window.clearInterval(timer);
  }, [template]);

  // When settings carry an active template, load its review state once.
  useEffect(() => {
    if (!settings?.activeTemplateId || template) return;
    void getTemplate(settings.activeTemplateId).then(
      (response) => setTemplate(response.document as TemplateStatus),
      () => undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.activeTemplateId]);

  // Keep the editable JSON in sync when a freshly extracted structure arrives.
  useEffect(() => {
    if (template?.templateStructure) {
      setStructureText(JSON.stringify(template.templateStructure, null, 2));
    }
  }, [template?.templateStructure]);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading settings…</div>;
  }

  const update = (key: string, value: string) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    const prompt = (form.systemPrompt ?? "").trim();
    await save({
      theme: form.theme,
      systemPrompt: prompt ? prompt : null,
    });
    setSaved(true);
    void refresh();
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    setTemplateError(null);
    try {
      const response = await uploadTemplate(file);
      setTemplate(response.document as TemplateStatus);
    } catch (caught) {
      setTemplateError(messageOf(caught));
    } finally {
      setUploading(false);
    }
  };

  const onApprove = async () => {
    if (!template) return;
    setTemplateError(null);
    try {
      await approveTemplate(template.id);
      setTemplate({ ...template, status: "READY" });
      await refresh();
    } catch (caught) {
      setTemplateError(messageOf(caught));
    }
  };

  const onReject = async () => {
    if (!template) return;
    setTemplateError(null);
    try {
      await rejectTemplate(template.id);
      setTemplate({ ...template, status: "FAILED", error: "Template rejected by user" });
    } catch (caught) {
      setTemplateError(messageOf(caught));
    }
  };

  const onSaveStructure = async () => {
    if (!template) return;
    setTemplateError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(structureText);
    } catch {
      setTemplateError("Structure is not valid JSON");
      return;
    }
    try {
      const response = await updateTemplateStructure(template.id, parsed);
      setTemplate(response.document as TemplateStatus);
    } catch (caught) {
      setTemplateError(messageOf(caught));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {settingsError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {settingsError}
        </div>
      )}
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Appearance</h2>
        <label className="mt-4 block max-w-sm text-sm">
          Theme
          <select
            value={form.theme ?? "system"}
            onChange={(event) => update("theme", event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border bg-background px-3"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="mt-4 block text-sm">
          Custom system prompt
          <textarea
            value={form.systemPrompt ?? ""}
            onChange={(event) => update("systemPrompt", event.target.value)}
            placeholder='e.g. "Selalu gunakan Bahasa Indonesia formal"'
            className="mt-2 min-h-28 w-full rounded-lg border bg-background p-3"
          />
        </label>
        <div className="mt-4 flex items-center gap-2">
          <Button disabled={saving} onClick={() => void onSave()}>
            <Save size={15} /> {saving ? "Saving…" : "Save settings"}
          </Button>
          {saved && <span className="text-xs text-muted-foreground">Saved.</span>}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">AI configuration</h2>
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            Managed by server — read-only
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Provider
            <input
              value={settings?.aiProvider ?? "openai"}
              disabled
              readOnly
              className="mt-2 h-10 w-full rounded-lg border bg-muted px-3 text-muted-foreground"
            />
          </label>
          <label className="text-sm">
            Model
            <input
              value={settings?.aiModel ?? "gpt-4o-mini"}
              disabled
              readOnly
              className="mt-2 h-10 w-full rounded-lg border bg-muted px-3 text-muted-foreground"
            />
          </label>
          <label className="text-sm">
            Base URL
            <input
              value={settings?.customBaseUrl ?? "Provider default"}
              disabled
              readOnly
              className="mt-2 h-10 w-full rounded-lg border bg-muted px-3 text-muted-foreground"
            />
          </label>
          <label className="text-sm">
            API key
            <input
              value="•••••••• (server-managed)"
              disabled
              readOnly
              className="mt-2 h-10 w-full rounded-lg border bg-muted px-3 text-muted-foreground"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">BRD template</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a company standard. Review the extracted structure before activating it —
              nothing is auto-applied.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
            <Upload size={15} /> {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept=".md,.pdf,.docx"
              disabled={uploading}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onUpload(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        {templateError && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {templateError}
          </div>
        )}

        {template && (
          <div className="mt-5 rounded-xl border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{template.title}</p>
                <p className="text-xs text-muted-foreground">Status: {template.status}</p>
                {template.error && (
                  <p className="mt-1 text-xs text-destructive">{template.error}</p>
                )}
              </div>
              {template.status === "PENDING_CONFIRMATION" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void onApprove()}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void onReject()}>
                    <X size={14} /> Reject
                  </Button>
                </div>
              )}
            </div>
            {template.status === "PENDING_CONFIRMATION" && template.templateStructure ? (
              <div className="mt-3">
                <textarea
                  value={structureText}
                  onChange={(event) => setStructureText(event.target.value)}
                  spellCheck={false}
                  className="min-h-48 w-full rounded-lg border bg-background p-3 font-mono text-xs"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void onSaveStructure()}>
                    Save structure
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Editable JSON — the approved structure is enforced during BRD drafting.
                  </span>
                </div>
              </div>
            ) : template.templateStructure ? (
              <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-background p-3 text-xs">
                {JSON.stringify(template.templateStructure, null, 2)}
              </pre>
            ) : (
              TRANSIENT_STATUSES.has(template.status) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Extracting structure… this refreshes automatically.
                </p>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
