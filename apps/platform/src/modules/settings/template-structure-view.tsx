import { useMemo } from "react";
import { ListTree, Tag } from "lucide-react";
import { Badge } from "#/components/base/badge";
import { parseTemplateStructure } from "#/lib/template-structure";

/**
 * Rincian struktur template yang mudah dibaca (bukan JSON mentah):
 * metadata, konvensi ID, lalu daftar bab beserta tujuan dan formatnya.
 */
export function TemplateStructureView({ structure }: { structure: unknown }) {
  const parsed = useMemo(() => parseTemplateStructure(structure), [structure]);

  if (!parsed) {
    return (
      <p className="text-[11px] text-slate-400">
        Struktur template belum dapat ditampilkan. Periksa kembali hasil ekstraksi.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ListTree size={13} className="shrink-0 text-slate-400" />
          <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
            {parsed.templateName ?? "Struktur template"}
          </span>
        </div>
        <span className="shrink-0 text-[10px] text-slate-400">
          {parsed.sections.length} bab standar
        </span>
      </div>

      {parsed.description && (
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {parsed.description}
        </p>
      )}

      {(parsed.language ||
        parsed.acceptanceStyle ||
        parsed.sourceFormat ||
        parsed.idConventions.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {parsed.language && (
            <Badge tone="neutral" mono>
              Bahasa: {parsed.language}
            </Badge>
          )}
          {parsed.acceptanceStyle && (
            <Badge tone="neutral">Acceptance: {parsed.acceptanceStyle}</Badge>
          )}
          {parsed.idConventions.length > 0 && (
            <Badge tone="info" mono>
              ID: {parsed.idConventions.join(" · ")}
            </Badge>
          )}
          {parsed.sourceFormat && (
            <Badge tone="neutral" mono>
              Sumber: {parsed.sourceFormat}
            </Badge>
          )}
        </div>
      )}

      <ol className="space-y-1.5">
        {parsed.sections.map((section, index) => (
          <li
            key={`${section.id}-${index}`}
            className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/50"
          >
            <span className="w-5 shrink-0 pt-px text-right font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {section.order}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {section.title}
                </span>
                <span className="rounded border border-slate-200 bg-white px-1 py-px font-mono text-[9px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  {section.id}
                </span>
                <Badge tone={section.required ? "success" : "neutral"} className="ml-auto shrink-0">
                  {section.required ? "Wajib" : "Opsional"}
                </Badge>
              </div>

              {section.purpose && (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {section.purpose}
                </p>
              )}

              {section.expectedFormat && (
                <p className="mt-1 flex items-start gap-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  <Tag size={10} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>Format: {section.expectedFormat}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
