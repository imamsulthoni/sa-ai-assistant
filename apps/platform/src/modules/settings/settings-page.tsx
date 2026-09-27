import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cpu,
  FileText,
  KeyRound,
  Layers,
  ListTree,
  LoaderCircle,
  Monitor,
  Moon,
  Pencil,
  RotateCcw,
  Save,
  Sliders,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "#/lib/utils";
import { Alert } from "#/components/base/alert";
import { Badge } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { Input } from "#/components/base/input";
import { Modal } from "#/components/base/modal";
import {
  createManualTemplate,
  getTemplate,
  updateTemplateStructure,
  uploadTemplate,
  type Settings,
  type TemplateSummary,
} from "#/lib/api";
import { describeError } from "#/lib/errors";
import { notify } from "#/lib/notify";
import { applyTheme } from "#/lib/theme";
import { relativeTime } from "#/lib/time";
import { useSettings } from "#/modules/settings/hooks/use-settings";
import { useTemplates } from "#/modules/settings/hooks/use-templates";
import { TemplateBuilder } from "#/modules/settings/template-builder";

export type SettingsTab = "theme" | "prompt" | "model" | "template";

const TRANSIENT_STATUSES = new Set(["UPLOADING", "PROCESSING"]);

const PROMPT_PRESETS = [
  {
    title: "Standar Enterprise & Perbankan",
    description: "SLA latensi ketat, kepatuhan audit trail, dan RACI governance.",
    content:
      "Gunakan gaya Lead Product Architect industri perbankan/fintech. Setiap klausul wajib punya batasan in-scope dan out-of-scope yang tegas, SLA latensi terukur (P95), enkripsi standar industri, serta kriteria penerimaan yang siap diuji QA.",
  },
  {
    title: "SaaS & Agile Sprint-Ready",
    description: "Padat sinyal, siap dipecah menjadi backlog Jira/Linear.",
    content:
      "Format spesifikasi agar langsung dapat dipecah tim engineering menjadi tiket sprint. Hindari narasi panjang. Gunakan tabel dependensi modul, penanganan error yang spesifik, dan kriteria rilis minimum viable.",
  },
  {
    title: "Regulated & Audit Heavy",
    description: "Jejak keputusan, retensi data, dan pemisahan tugas.",
    content:
      "Tekankan jejak audit: setiap kebutuhan merujuk regulasi terkait, pemisahan tugas (maker-checker), retensi data eksplisit, dan skenario kegagalan yang terdokumentasi.",
  },
];

function messageOf(error: unknown): string {
  return describeError(error);
}

/** Modal pengaturan terkendali (dipakai workspace). */
export function SettingsModal({
  open,
  onClose,
  initialTab = "theme",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title="Pengaturan Sistem & Model AI"
      description="Konfigurasi tema, prompt instruksi, model AI, dan template struktur BRD"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
      footer={
        <span className="mr-auto text-[11px] text-muted-foreground">
          Perubahan konfigurasi tersimpan pada akun demo ini.
        </span>
      }
    >
      <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted p-2 md:w-56 md:flex-col md:overflow-x-visible md:border-r md:border-b-0">
          <TabButton active={tab === "theme"} onClick={() => setTab("theme")}>
            <Sun size={13} /> Tampilan &amp; Tema
          </TabButton>
          <TabButton active={tab === "prompt"} onClick={() => setTab("prompt")}>
            <FileText size={13} /> Instruksi Prompt AI
          </TabButton>
          <TabButton active={tab === "model"} onClick={() => setTab("model")}>
            <Cpu size={13} /> Model AI
          </TabButton>
          <TabButton active={tab === "template"} onClick={() => setTab("template")}>
            <Layers size={13} /> Template Struktur BRD
          </TabButton>
        </nav>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
          <SettingsContent tab={tab} open={open} />
        </div>
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
        active
          ? "bg-muted font-semibold text-foreground shadow-xs"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function SettingsContent({
  tab = "theme",
  open = true,
}: {
  tab?: SettingsTab;
  open?: boolean;
}) {
  const {
    settings,
    modelDefaults,
    hasServerApiKey,
    loading,
    saving,
    error: settingsError,
    save,
    refresh,
  } = useSettings();
  const [form, setForm] = useState<Partial<Settings>>({});
  const [uploading, setUploading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [builderMode, setBuilderMode] = useState<"create" | "edit" | null>(null);
  const [builderEditId, setBuilderEditId] = useState<string | null>(null);
  const [builderInitial, setBuilderInitial] = useState<unknown>(null);
  const [structureBusy, setStructureBusy] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const {
    templates,
    activeTemplateId,
    loading: templatesLoading,
    error: templatesError,
    refresh: refreshTemplates,
    setActive: setActiveTemplate,
    remove: removeTemplate,
    busy: templateBusy,
  } = useTemplates();

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  // Tutup builder saat modal ditutup supaya tidak ada form setengah terisi
  // yang muncul kembali.
  useEffect(() => {
    if (!open) setBuilderMode(null);
  }, [open]);

  useEffect(() => {
    const theme = form.theme ?? settings?.theme;
    if (theme) applyTheme(theme);
  }, [form.theme, settings?.theme]);

  const isTemplateTransient = templates.some((item) => TRANSIENT_STATUSES.has(item.status));

  // Selama masih ada ekstraksi berjalan, daftar disegarkan berkala sampai
  // statusnya selesai.
  useEffect(() => {
    if (!isTemplateTransient) return;
    const timer = window.setInterval(() => refreshTemplates(), 2000);
    return () => window.clearInterval(timer);
  }, [isTemplateTransient, refreshTemplates]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <LoaderCircle size={13} className="animate-spin" /> Memuat pengaturan…
      </div>
    );
  }

  const update = (key: string, value: string) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    const prompt = (form.systemPrompt ?? "").trim();
    const baseUrl = (form.customBaseUrl ?? "").trim();
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      notify.error("Base URL harus diawali http:// atau https://.");
      return;
    }
    const apiKey = apiKeyDraft.trim();
    try {
      await save({
        theme: form.theme,
        systemPrompt: prompt ? prompt : null,
        aiProvider: form.aiProvider,
        aiModel: form.aiModel?.trim() || null,
        easyModel: form.easyModel?.trim() || null,
        mediumModel: form.mediumModel?.trim() || null,
        hardModel: form.hardModel?.trim() || null,
        customBaseUrl: baseUrl || null,
        ...(clearApiKey ? { apiKey: null } : apiKey ? { apiKey } : {}),
      });
      setSaved(true);
      setApiKeyDraft("");
      setClearApiKey(false);
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
      await uploadTemplate(file);
      refreshTemplates();
      notify.success("Template diunggah. Struktur sedang diekstrak…");
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    } finally {
      setUploading(false);
    }
  };

  const openBuilderEdit = async (id: string) => {
    setTemplateError(null);
    try {
      const response = await getTemplate(id);
      setBuilderEditId(id);
      setBuilderInitial(response.document.templateStructure ?? null);
      setBuilderMode("edit");
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    }
  };

  const onSetActiveTemplate = async (id: string) => {
    setTemplateError(null);
    try {
      await setActiveTemplate(id);
      notify.success("Template aktif diperbarui. Project tanpa pilihan template memakai template ini.");
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    }
  };

  const onDeleteTemplate = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setTemplateError(null);
    try {
      await removeTemplate(deleteTarget.id);
      notify.info(`Template "${deleteTarget.title}" dihapus.`);
      setDeleteTarget(null);
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const onSaveManualTemplate = async (values: {
    title: string;
    templateStructure: unknown;
  }) => {
    setStructureBusy(true);
    setTemplateError(null);
    const editingId = builderMode === "edit" ? builderEditId : null;
    try {
      if (editingId) {
        await updateTemplateStructure(editingId, values.templateStructure);
      } else {
        await createManualTemplate(values);
      }
      refreshTemplates();
      setBuilderMode(null);
      notify.success(
        editingId
          ? "Struktur template diperbarui."
          : "Template manual dibuat dan langsung diaktifkan.",
      );
    } catch (caught) {
      const message = messageOf(caught);
      setTemplateError(message);
      notify.error(message);
    } finally {
      setStructureBusy(false);
    }
  };

  const theme = form.theme ?? settings?.theme ?? "system";
  // Unggahan diblokir selama unggah berjalan dan selama ada ekstraksi berjalan.
  const uploadLocked = uploading || isTemplateTransient;

  return (
    <div className="space-y-4">
      {settingsError && <Alert tone="destructive">{settingsError}</Alert>}

      {tab === "theme" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-foreground uppercase">
              Tema Warna Antarmuka
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pilih skema tema netral untuk kenyamanan penulisan dokumen.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                {
                  value: "light",
                  icon: Sun,
                  title: "Terang (Light)",
                  hint: "Kanvas terang bersih",
                },
                { value: "dark", icon: Moon, title: "Gelap (Dark)", hint: "Ramah mata malam" },
                {
                  value: "system",
                  icon: Monitor,
                  title: "Sistem (Auto)",
                  hint: "Mengikuti OS perangkat",
                },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("theme", option.value)}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-card ring-1 ring-ring/40"
                      : "border-border bg-muted hover:border-primary/40",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Icon size={15} className="text-muted-foreground" />
                    {selected && <span className="size-2 rounded-full bg-success" />}
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {option.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {option.hint}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button disabled={saving} onClick={() => void onSave()}>
              <Save size={13} /> {saving ? "Menyimpan…" : "Simpan pengaturan"}
            </Button>
            {saved && <span className="text-xs text-muted-foreground">Tersimpan.</span>}
          </div>
        </div>
      )}

      {tab === "prompt" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-foreground uppercase">
                Instruksi Sistem Tambahan
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Instruksi ini disisipkan pada setiap generasi klausul dan dialog agen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => update("systemPrompt", "")}
              className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              Pilih preset industri cepat:
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => update("systemPrompt", preset.content)}
                  className="cursor-pointer rounded-lg border border-border bg-muted p-2.5 text-left transition-colors hover:border-primary/40"
                >
                  <div className="text-xs font-semibold text-foreground">
                    {preset.title}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Teks instruksi custom:
            </span>
            <textarea
              rows={6}
              value={form.systemPrompt ?? ""}
              onChange={(event) => update("systemPrompt", event.target.value)}
              placeholder="Contoh: Semua tanggal wajib format DD-MM-YYYY; setiap API wajib mTLS."
              className="w-full rounded-lg border border-input bg-card p-2.5 font-mono text-xs text-foreground focus:ring-1 focus:ring-ring focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Mengikat formulasi klausul BRD & penanganan revisi.</span>
              <span>{(form.systemPrompt ?? "").length} karakter</span>
            </div>
          </label>

          <div className="flex items-center gap-2">
            <Button disabled={saving} onClick={() => void onSave()}>
              <Save size={13} /> {saving ? "Menyimpan…" : "Simpan instruksi"}
            </Button>
            {saved && <span className="text-xs text-muted-foreground">Tersimpan.</span>}
          </div>
        </div>
      )}

      {tab === "model" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-foreground uppercase">
              Konfigurasi Model AI
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Opsional — kosongkan field untuk memakai default sistem. Perubahan berlaku untuk
              generasi dan dialog agen berikutnya.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                Provider
              </span>
              <select
                value={form.aiProvider ?? settings?.aiProvider ?? "openrouter"}
                onChange={(event) => update("aiProvider", event.target.value)}
                className="w-full rounded-md border border-input bg-card px-2 py-2 text-xs text-foreground transition-colors focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
              >
                <option value="openrouter">OpenRouter (default)</option>
                <option value="custom">Custom provider</option>
              </select>
              <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                {form.aiProvider === "custom"
                  ? "Provider OpenAI-compatible milik Anda: isi Base URL dan API key."
                  : "Memakai endpoint OpenRouter; API key default server bila dikosongkan."}
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                Base URL
              </span>
              <Input
                value={form.customBaseUrl ?? ""}
                onChange={(event) => update("customBaseUrl", event.target.value)}
                placeholder={modelDefaults?.baseUrl ?? "https://openrouter.ai/api/v1"}
                spellCheck={false}
              />
              <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                Contoh: https://openrouter.ai/api/v1
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <KeyRound size={11} /> API Key
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(event) => {
                    setApiKeyDraft(event.target.value);
                    setClearApiKey(false);
                  }}
                  autoComplete="off"
                  placeholder={
                    settings?.encryptedApiKey
                      ? "•••••••• (tersimpan)"
                      : hasServerApiKey
                        ? "Kosongkan untuk memakai key default server"
                        : "Masukkan API key provider"
                  }
                />
                {settings?.encryptedApiKey && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clearApiKey}
                    onClick={() => {
                      setClearApiKey(true);
                      setApiKeyDraft("");
                    }}
                  >
                    <Trash2 size={12} /> {clearApiKey ? "Akan dihapus" : "Hapus"}
                  </Button>
                )}
              </div>
              <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                {clearApiKey
                  ? "API key tersimpan akan dihapus saat disimpan."
                  : "Biarkan kosong untuk mempertahankan key yang tersimpan."}
              </span>
            </label>
          </div>

          <div className="rounded-lg border border-border bg-muted p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Cpu size={12} /> Routing model per tingkat kesulitan
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  { key: "aiModel", label: "Model default", hint: "Fallback semua tingkat." },
                  { key: "easyModel", label: "Model easy", hint: "Klarifikasi cepat." },
                  { key: "mediumModel", label: "Model medium", hint: "QA & judge BRD." },
                  { key: "hardModel", label: "Model hard", hint: "Generate BRD penuh." },
                ] as const
              ).map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    {field.label}
                  </span>
                  <Input
                    value={form[field.key] ?? ""}
                    onChange={(event) => update(field.key, event.target.value)}
                    placeholder={modelDefaults?.[field.key] ?? "default sistem"}
                    spellCheck={false}
                  />
                  <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                    {field.hint}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button disabled={saving} onClick={() => void onSave()}>
              <Save size={13} /> {saving ? "Menyimpan…" : "Simpan pengaturan model"}
            </Button>
            {saved && <span className="text-xs text-muted-foreground">Tersimpan.</span>}
          </div>
        </div>
      )}

      {tab === "template" &&
        (builderMode ? (
          <TemplateBuilder
            initialStructure={builderMode === "edit" ? builderInitial : undefined}
            busy={structureBusy}
            onCancel={() => setBuilderMode(null)}
            onSave={onSaveManualTemplate}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold tracking-wider text-foreground uppercase">
                  Template Struktur Acuan BRD
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Kelola beberapa template sekaligus. Template <strong>aktif</strong> otomatis
                  dipakai project yang belum memilih template sendiri.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploadLocked}
                  onClick={() => {
                    setBuilderEditId(null);
                    setBuilderInitial(null);
                    setBuilderMode("create");
                  }}
                >
                  <ListTree size={13} /> Susun manual
                </Button>
                <label
                  aria-disabled={uploadLocked}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                    uploadLocked
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:bg-muted",
                  )}
                >
                  {uploadLocked ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    <Upload size={13} />
                  )}
                  {uploading
                    ? "Mengunggah…"
                    : isTemplateTransient
                      ? "Mengekstrak…"
                      : "Unggah template"}
                  <input
                    type="file"
                    accept=".md,.pdf,.docx"
                    disabled={uploadLocked}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onUpload(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            {(templateError || templatesError) && (
              <Alert tone="destructive">{templateError ?? templatesError}</Alert>
            )}

            {templatesLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-xs text-muted-foreground">
                <LoaderCircle size={13} className="animate-spin" /> Memuat template…
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-center">
                <Sliders size={18} className="mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">
                  Belum ada template
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Unggah dokumen standar BRD, atau susun strukturnya sendiri secara manual.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {templates.map((item) => {
                  const active = item.id === activeTemplateId;
                  const transient = TRANSIENT_STATUSES.has(item.status);
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-lg border bg-card p-3.5",
                        active
                          ? "border-success/30 ring-1 ring-success/30"
                          : "border-border",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {item.title}
                            </p>
                            {active && (
                              <Badge tone="success" className="rounded-md">
                                Aktif
                              </Badge>
                            )}
                            {transient && (
                              <Badge tone="info" className="rounded-md">
                                Diproses
                              </Badge>
                            )}
                            {item.status === "FAILED" && (
                              <Badge tone="danger" className="rounded-md">
                                Gagal
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {item.hasStructure
                              ? `${item.sectionCount} section`
                              : "Belum ada struktur"}
                            {" · "}
                            {relativeTime(item.updatedAt)}
                            {active && " · dipakai project tanpa pilihan template"}
                          </p>
                          {item.error && (
                            <p className="mt-1 text-[11px] text-destructive">
                              {item.error}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!active && item.status === "READY" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={templateBusy}
                              onClick={() => void onSetActiveTemplate(item.id)}
                            >
                              <CheckCircle2 size={12} /> Jadikan aktif
                            </Button>
                          )}
                          {item.hasStructure && !transient && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={templateBusy}
                              onClick={() => void openBuilderEdit(item.id)}
                            >
                              <Pencil size={12} /> Edit struktur
                            </Button>
                          )}
                          {!transient && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              disabled={templateBusy}
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 size={12} /> Hapus
                            </Button>
                          )}
                        </div>
                      </div>

                      {transient && !item.hasStructure && (
                        <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-warning">
                          Proses ekstraksi memakan waktu yang agak lama, mohon tunggu sampai
                          selesai (jangan tutup halaman).
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        size="sm"
        className="z-[70]"
        title="Hapus template?"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={deleteBusy}
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deleteBusy}
              onClick={() => void onDeleteTemplate()}
            >
              <Trash2 size={12} /> {deleteBusy ? "Menghapus…" : "Hapus template"}
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          Template beserta berkas referensi dan struktur hasil ekstraksinya akan dihapus permanen.
          {deleteTarget?.id === activeTemplateId
            ? " Karena ini template aktif, project yang memakainya akan memakai template aktif berikutnya bila tersedia."
            : ""}
        </p>
        {deleteTarget && (
          <p className="mt-2.5 truncate rounded border border-border bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
            {deleteTarget.title}
          </p>
        )}
      </Modal>
    </div>
  );
}
