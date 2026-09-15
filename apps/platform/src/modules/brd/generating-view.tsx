import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "#/components/base/button";
import { COPY } from "#/lib/copy";

const STEPS = [
  "Memetakan user story & ekstraksi problem statement",
  "Mengintegrasikan hasil klarifikasi putaran 1 & 2",
  "Menyusun spesifikasi fungsional (FR) & NFR",
  "Memformat Markdown & finalisasi BRD versi 1.0",
];

const STEP_INTERVAL_MS = 1200;

export function GeneratingView({
  templateName,
  resumable,
  onResume,
}: {
  templateName?: string | null;
  resumable?: boolean;
  onResume?: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (resumable) return;
    const timer = window.setInterval(() => {
      setStepIndex((index) => (index >= STEPS.length - 1 ? index : index + 1));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [resumable]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="relative mx-auto size-12">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900 dark:border-slate-800 dark:border-t-slate-100" />
          <Sparkles className="absolute inset-0 m-auto size-4 animate-pulse text-slate-700 dark:text-slate-300" />
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {resumable ? COPY.flow.resumeTitle : COPY.flow.generatingTitle}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {resumable ? (
              COPY.flow.resumeBody
            ) : (
              <>
                Acuan: <strong>{templateName || COPY.sidebar.noTemplate}</strong>
              </>
            )}
          </p>
        </div>

        {resumable ? (
          <Button className="w-full" onClick={() => onResume?.()}>
            {COPY.flow.resumeAction}
          </Button>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-left text-xs dark:border-slate-800 dark:bg-slate-900">
            {STEPS.map((step, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <div key={step} className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle2
                      size={14}
                      className="shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                  ) : current ? (
                    <LoaderCircle
                      size={14}
                      className="shrink-0 animate-spin text-slate-800 dark:text-slate-200"
                    />
                  ) : (
                    <span className="size-3.5 shrink-0 rounded-full border border-slate-300 dark:border-slate-700" />
                  )}
                  <span
                    className={
                      done
                        ? "font-medium text-slate-700 dark:text-slate-300"
                        : current
                          ? "font-semibold text-slate-900 dark:text-slate-100"
                          : "text-slate-400 dark:text-slate-600"
                    }
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
