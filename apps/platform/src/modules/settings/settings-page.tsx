import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Code,
  FileText,
  Layers,
  LoaderCircle,
  Monitor,
  Moon,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Sliders,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { cn } from "#/lib/utils";
import { Alert } from "#/components/base/alert";
import { Button } from "#/components/base/button";
import { Modal } from "#/components/base/modal";
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
import { CURRENT_TEMPLATE_QUERY_KEY } from "#/modules/settings/hooks/use-current-template";
import { TemplateStructureView } from "#/modules/settings/template-structure-view";

export type SettingsTab = "theme" | "prompt" | "template";

type TemplateStatus = DocumentSummary & {
  templateStructure?: unknown;
  error: string | null;
};

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

function applyTheme(theme: string | undefined) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme !== "light" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

function messageOf(error: unknown): string {
  return describeError(error);
}

/** Dialog mandiri dengan tombol pemicu (dipakai halaman landing). */
export function SettingsDialog({ initialTab }: { initialTab?: SettingsTab }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <SettingsIcon size={13} /> Pengaturan
      </Button>
      <SettingsModal open={open} onClose={() => setOpen(false)} initialTab={initialTab} />
    </>
  );
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
      description="Konfigurasi tema, prompt instruksi, dan template struktur BRD"
      bodyClassName="p-0"
      footer={
        <span className="mr-auto text-[11px] text-slate-400">
          Perubahan konfigurasi tersimpan pada akun demo ini.
        </span>
      }
    >
      <div className="flex flex-col md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/60 p-2 md:w-56 md:flex-col md:border-r md:border-b-0 dark:border-slate-800 dark:bg-slate-950/30">
          <TabButton active={tab === "theme"} onClick={() => setTab("theme")}>
            <Sun size={13} /> Tampilan &amp; Tema
          </TabButton>
          <TabButton active={tab === "prompt"} onClick={() => setTab("prompt")}>
            <FileText size={13} /> Instruksi Prompt AI
          </TabButton>
          <TabButton active={tab === "template"} onClick={() => setTab("template")}>
            <Layers size={13} /> Template Struktur BRD
          </TabButton>
        </nav>

        <div className="min-w-0 flex-1 p-5">
          <SettingsContent tab={tab} />
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
          ? "bg-slate-200 font-semibold text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60",
      )}
    >
      {children}
    </button>
  );
}

export function SettingsContent({ tab = "theme" }: { tab?: SettingsTab }) {
  const { settings, loading, saving, error: settingsError, save, refresh } = useSettings();
  const queryClient = useQueryClient();
  const refreshHeaderTemplate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: CURRENT_TEMPLATE_QUERY_KEY });
  }, [queryClient]);
  const [form, setForm] = useState<Partial<Settings>>({});
  const [template, setTemplate] = useState<TemplateStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [structureText, setStructureText] = useState("");
  const [editingStructure, setEditingStructure] = useState(false);
  const [showRawStructure, setShowRawStructure] = useState(false);

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
    setEditingStructure(false);
    setShowRawStructure(false);
  }, [template?.id, template?.templateStructure]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-slate-500">
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
      refreshHeaderTemplate();
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
      refreshHeaderTemplate();
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
      refreshHeaderTemplate();
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

  const theme = form.theme ?? settings?.theme ?? "system";

  return (
    <div className="space-y-4">
      {settingsError && <Alert tone="destructive">{settingsError}</Alert>}

      {tab === "theme" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-slate-100">
              Tema Warna Antarmuka
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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
                      ? "border-slate-800 bg-white ring-1 ring-slate-800 dark:border-slate-200 dark:bg-slate-800 dark:ring-slate-200"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Icon size={15} className="text-slate-700 dark:text-slate-300" />
                    {selected && <span className="size-2 rounded-full bg-emerald-500" />}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {option.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
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
            {saved && <span className="text-xs text-slate-400">Tersimpan.</span>}
          </div>
        </div>
      )}

      {tab === "prompt" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-slate-100">
                Instruksi Sistem Tambahan
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Instruksi ini disisipkan pada setiap generasi klausul dan dialog agen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => update("systemPrompt", "")}
              className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Pilih preset industri cepat:
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => update("systemPrompt", preset.content)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-left transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {preset.title}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Teks instruksi custom:
            </span>
            <textarea
              rows={6}
              value={form.systemPrompt ?? ""}
              onChange={(event) => update("systemPrompt", event.target.value)}
              placeholder="Contoh: Semua tanggal wajib format DD-MM-YYYY; setiap API wajib mTLS."
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs text-slate-900 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>Mengikat formulasi klausul BRD & penanganan revisi.</span>
              <span>{(form.systemPrompt ?? "").length} karakter</span>
            </div>
          </label>

          <div className="flex items-center gap-2">
            <Button disabled={saving} onClick={() => void onSave()}>
              <Save size={13} /> {saving ? "Menyimpan…" : "Simpan instruksi"}
            </Button>
            {saved && <span className="text-xs text-slate-400">Tersimpan.</span>}
          </div>
        </div>
      )}

      {tab === "template" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-slate-100">
                Template Struktur Acuan BRD
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Unggah standar perusahaan. Tinjau struktur hasil ekstraksi sebelum mengaktifkannya.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              {uploading ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              {uploading ? "Mengunggah…" : "Unggah template"}
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

          {templateError && <Alert tone="destructive">{templateError}</Alert>}

          {template ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {template.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Status: {template.status}
                  </p>
                  {template.error && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                      {template.error}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {template.status === "PENDING_CONFIRMATION" && (
                    <>
                      <Button size="sm" variant="success" onClick={() => void onApprove()}>
                        <Check size={12} /> Setujui
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onReject()}>
                        <X size={12} /> Tolak
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => void onResetTemplate()}>
                    <X size={12} /> Reset template
                  </Button>
                </div>
              </div>

              {template.status === "PENDING_CONFIRMATION" && template.templateStructure ? (
                <div className="mt-3 space-y-3">
                  <TemplateStructureView structure={template.templateStructure} />

                  <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingStructure((open) => !open)}
                      >
                        <Code size={12} />
                        {editingStructure ? "Tutup editor JSON" : "Edit struktur (JSON)"}
                      </Button>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        JSON yang disimpan dipakai sebagai struktur wajib saat menyusun BRD.
                      </span>
                    </div>
                    {editingStructure && (
                      <div className="mt-3">
                        <textarea
                          value={structureText}
                          onChange={(event) => setStructureText(event.target.value)}
                          spellCheck={false}
                          className="min-h-48 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                        />
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void onSaveStructure()}
                          >
                            <Save size={12} /> Simpan struktur
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : template.templateStructure ? (
                <div className="mt-3 space-y-3">
                  <TemplateStructureView structure={template.templateStructure} />
                  <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowRawStructure((open) => !open)}
                      className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    >
                      <Code size={11} /> {showRawStructure ? "Sembunyikan JSON" : "Lihat JSON"}
                    </button>
                    {showRawStructure && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-950">
                        {JSON.stringify(template.templateStructure, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                TRANSIENT_STATUSES.has(template.status) && (
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <LoaderCircle size={11} className="animate-spin" /> Mengekstrak struktur…
                    halaman ini menyegarkan otomatis.
                  </p>
                )
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center dark:border-slate-700">
              <Sliders size={18} className="mx-auto mb-1.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Belum ada template aktif
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Unggah dokumen standar BRD untuk mengekstrak struktur wajibnya.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
