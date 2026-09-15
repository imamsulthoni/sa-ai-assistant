import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Save, Settings as SettingsIcon, Upload, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Alert } from "#/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
  approveTemplate,
  getCurrentTemplate,
  getTemplate,
  rejectTemplate,
  resetTemplate,
  updateTemplateStructure,
  uploadTemplate,
  type DocumentSummary,
  type Settings,
} from "#/lib/api";
import { describeError } from "#/lib/errors";
import { notify } from "#/lib/notify";
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
  return describeError(error);
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
          <SettingsIcon size={16} /> Pengaturan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[95dvh] max-w-5xl gap-5 overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Pengaturan</DialogTitle>
          <DialogDescription>
            Model &amp; kredensial AI disediakan server — ditampilkan sebagai info dan tidak bisa
            diubah dari sini.
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

  // Bumped by every explicit action so a late poll/hydrate response can never
  // overwrite a fresher server state (e.g. after approve).
  const templateEpoch = useRef(0);

  const loadCurrentTemplate = useCallback(async () => {
    const epoch = ++templateEpoch.current;
    try {
      const response = await getCurrentTemplate();
      if (epoch !== templateEpoch.current) return;
      setTemplate(response.document as TemplateStatus | null);
    } catch {
      // Hydration failures surface through the next explicit action.
    }
  }, []);

  useEffect(() => {
    void loadCurrentTemplate();
  }, [loadCurrentTemplate]);

  useEffect(() => {
    if (!template || !TRANSIENT_STATUSES.has(template.status)) return;
    const epoch = templateEpoch.current;
    const timer = window.setInterval(() => {
      void getTemplate(template.id).then(
        (response) => {
          if (epoch !== templateEpoch.current) return;
          setTemplate(response.document as TemplateStatus);
        },
        () => undefined,
      );
    }, 2000);
    return () => window.clearInterval(timer);
  }, [template]);

  useEffect(() => {
    if (template?.templateStructure) {
      setStructureText(JSON.stringify(template.templateStructure, null, 2));
    }
  }, [template?.templateStructure]);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Memuat pengaturan…</div>;
  }

  const update = (key: string, value: string) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    const prompt = (form.systemPrompt ?? "").trim();
    try {
      await save({
        theme: form.theme,
        systemPrompt: prompt ? prompt : null,
      });
      setSaved(true);
      notify.success("Preferensi disimpan.");
      void refresh();
    } catch (caught) {
      notify.error(messageOf(caught));
    }
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    setTemplateError(null);
    try {
      const response = await uploadTemplate(file);
      templateEpoch.current += 1;
      setTemplate(response.document as TemplateStatus);
      notify.success("Template diunggah. Struktur sedang diekstrak…");
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    } finally {
      setUploading(false);
    }
  };

  const onApprove = async () => {
    if (!template) return;
    setTemplateError(null);
    try {
      await approveTemplate(template.id);
      await refresh();
      await loadCurrentTemplate();
      notify.success("Template diaktifkan untuk draft berikutnya.");
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    }
  };

  const onReject = async () => {
    if (!template) return;
    setTemplateError(null);
    try {
      await rejectTemplate(template.id);
      await loadCurrentTemplate();
      notify.info("Template ditolak.");
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    }
  };

  const onResetTemplate = async () => {
    if (!window.confirm("Reset template BRD aktif dan hapus berkas referensinya?")) return;
    setTemplateError(null);
    try {
      await resetTemplate();
      setStructureText("");
      await refresh();
      await loadCurrentTemplate();
      notify.info("Template aktif direset.");
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    }
  };

  const onSaveStructure = async () => {
    if (!template) return;
    setTemplateError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(structureText);
    } catch {
      setTemplateError("Struktur bukan JSON yang valid.");
      return;
    }
    try {
      const response = await updateTemplateStructure(template.id, parsed);
      templateEpoch.current += 1;
      setTemplate(response.document as TemplateStatus);
      notify.success("Struktur template disimpan.");
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {settingsError && <Alert variant="destructive">{settingsError}</Alert>}

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance">Tampilan</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="template">Template BRD</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="font-display font-semibold">Tampilan</h2>
            <label className="mt-4 block max-w-sm text-sm">
              Tema
              <select
                value={form.theme ?? "system"}
                onChange={(event) => update("theme", event.target.value)}
                className="mt-2 h-10 w-full rounded-lg border bg-background px-3"
              >
                <option value="system">Ikuti sistem</option>
                <option value="light">Terang</option>
                <option value="dark">Gelap</option>
              </select>
            </label>
            <label className="mt-4 block text-sm">
              Instruksi tambahan untuk agen
              <textarea
                value={form.systemPrompt ?? ""}
                onChange={(event) => update("systemPrompt", event.target.value)}
                placeholder='Contoh: "Selalu gunakan Bahasa Indonesia formal"'
                className="mt-2 min-h-28 w-full rounded-lg border bg-background p-3"
              />
            </label>
            <div className="mt-4 flex items-center gap-2">
              <Button disabled={saving} onClick={() => void onSave()}>
                <Save size={15} /> {saving ? "Menyimpan…" : "Simpan pengaturan"}
              </Button>
              {saved && <span className="text-xs text-muted-foreground">Tersimpan.</span>}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="ai">
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-semibold">Konfigurasi AI</h2>
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                Dikelola server — hanya baca
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
                  value={settings?.customBaseUrl ?? "Default provider"}
                  disabled
                  readOnly
                  className="mt-2 h-10 w-full rounded-lg border bg-muted px-3 text-muted-foreground"
                />
              </label>
              <label className="text-sm">
                API key
                <input
                  value="•••••••• (dikelola server)"
                  disabled
                  readOnly
                  className="mt-2 h-10 w-full rounded-lg border bg-muted px-3 text-muted-foreground"
                />
              </label>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="template">
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold">Template BRD</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Unggah standar perusahaan. Tinjau struktur hasil ekstraksi sebelum mengaktifkannya
                  — tidak ada yang otomatis dipakai.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent">
                <Upload size={15} /> {uploading ? "Mengunggah…" : "Unggah"}
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
              <Alert variant="destructive" className="mt-4">
                {templateError}
              </Alert>
            )}

            {template && (
              <div className="mt-5 rounded-xl border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{template.title}</p>
                    <p className="text-xs text-muted-foreground">Status: {template.status}</p>
                    {template.error && (
                      <p className="mt-1 text-xs text-destructive">{template.error}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {template.status === "PENDING_CONFIRMATION" && (
                      <>
                        <Button size="sm" onClick={() => void onApprove()}>
                          <Check size={14} /> Setujui
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void onReject()}>
                          <X size={14} /> Tolak
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => void onResetTemplate()}>
                      <X size={14} /> Reset template
                    </Button>
                  </div>
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
                        Simpan struktur
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        JSON yang disetujui dipakai sebagai struktur wajib saat menyusun BRD.
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
                      Mengekstrak struktur… halaman ini menyegarkan otomatis.
                    </p>
                  )
                )}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
