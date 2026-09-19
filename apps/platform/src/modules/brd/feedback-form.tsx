import { useState } from "react";
import { AlertCircle, ArrowRight, Check, Copy, LoaderCircle } from "lucide-react";
import { cn } from "#/lib/utils";
import { Button } from "#/components/base/button";
import { Textarea } from "#/components/base/input";
import { COPY } from "#/lib/copy";
import { notify } from "#/lib/notify";

export type ClarificationQuestion = {
  id: string;
  question: string;
  purpose?: string;
  options?: string[];
  required?: boolean;
};

type FeedbackFormProps = {
  questions: ClarificationQuestion[];
  round: number;
  initialAnswers?: Record<string, string>;
  onSubmit: (answers: Record<string, string>) => void | Promise<void>;
};

export function FeedbackForm({
  questions,
  round,
  initialAnswers,
  onSubmit,
}: FeedbackFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const merged: Record<string, string> = {};
    for (const question of questions) {
      const value = initialAnswers?.[question.id];
      if (value) merged[question.id] = value;
      const custom = initialAnswers?.[`${question.id}:custom`];
      if (custom) merged[`${question.id}:custom`] = custom;
    }
    return merged;
  });
  const [submitting, setSubmitting] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyQuestions = async () => {
    const lines = [
      `Bantu saya menjawab pertanyaan klarifikasi BRD berikut (Putaran ${round}). Jawab singkat, spesifik, dan berurutan.`,
      "",
    ];
    questions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question.question}`);
      if (question.purpose) lines.push(`   Tujuan: ${question.purpose}`);
      if (question.options?.length) lines.push(`   Opsi: ${question.options.join(" | ")}`);
      lines.push("");
    });
    lines.push("Format jawaban:");
    questions.forEach((_, index) => lines.push(`${index + 1}. `));
    const text = lines.join("\n");

    const markCopied = () => {
      setCopied(true);
      notify.success(COPY.clarify.copiedQuestions);
      window.setTimeout(() => setCopied(false), 2500);
    };

    try {
      await navigator.clipboard.writeText(text);
      markCopied();
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        markCopied();
      } catch {
        notify.error(COPY.clarify.copyFailed);
      }
    }
  };

  const answered = questions.filter((question) => answers[question.id]?.trim()).length;
  const missing = questions.find((question) => !answers[question.id]?.trim()) ?? null;

  const submit = async () => {
    if (missing) {
      setShowMissing(true);
      return;
    }
    setShowMissing(false);
    setSubmitting(true);
    try {
      await onSubmit(answers);
    } finally {
      setSubmitting(false);
    }
  };

  const selectOption = (question: ClarificationQuestion, option: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [question.id]: option };
      delete next[`${question.id}:custom`];
      return next;
    });
  };

  const writeCustom = (question: ClarificationQuestion, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [`${question.id}:custom`]: value,
      [question.id]: value,
    }));
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4">
      <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-sky-300 bg-sky-50 px-1.5 py-px text-[10px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              {COPY.clarify.roundLabel(round)}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-px text-[10px] font-medium",
                answered === questions.length
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
              )}
            >
              {COPY.clarify.answered(answered, questions.length)}
            </span>
          </div>
          <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
            {round === 1 ? COPY.clarify.titleRound1 : COPY.clarify.titleRound2}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => void copyQuestions()}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {COPY.clarify.copyQuestions}
          </Button>
          <div className="hidden w-24 shrink-0 overflow-hidden rounded-full bg-slate-200 sm:block dark:bg-slate-700">
            <div
              className="h-1.5 rounded-full bg-slate-800 transition-all duration-300 dark:bg-slate-200"
              style={{ width: `${Math.min(round / 2, 1) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3.5 p-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{COPY.clarify.subtitle}</p>

          {questions.map((question, index) => {
            const chips = question.options ?? [];
            const custom = answers[`${question.id}:custom`] ?? "";
            return (
              <div
                key={question.id}
                className="space-y-2 rounded-md border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {COPY.clarify.questionLabel} wajib
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">#{index + 1}</span>
                </div>

                <h3 className="text-xs leading-snug font-semibold text-slate-900 dark:text-slate-100">
                  {question.question}
                </h3>

                {question.purpose && (
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {question.purpose}
                  </p>
                )}

                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {chips.map((option) => {
                      const chosen = answers[question.id] === option && !custom;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => selectOption(question, option)}
                          className={cn(
                            "cursor-pointer rounded border px-2 py-0.5 text-left text-xs transition-colors",
                            chosen
                              ? "border-slate-900 bg-slate-900 font-medium text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                <Textarea
                  rows={2}
                  value={custom}
                  onChange={(event) => writeCustom(question, event.target.value)}
                  placeholder={COPY.clarify.customPlaceholder}
                  aria-label={`Jawaban sendiri untuk: ${question.question}`}
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            );
          })}

          {showMissing && missing && (
            <p className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={13} />
              {COPY.clarify.requiredError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <Button disabled={submitting} onClick={() => void submit()}>
              {submitting && <LoaderCircle size={13} className="animate-spin" />}
              {submitting
                ? COPY.clarify.preparing
                : round === 2
                  ? COPY.clarify.submitRound2
                  : COPY.clarify.submitRound1}
              {!submitting && <ArrowRight size={13} />}
            </Button>
          </div>
          <p className="text-[11px] text-slate-400">
            {round === 2 ? COPY.clarify.completeHint : COPY.clarify.nextRoundHint}
          </p>
        </div>
      </div>
    </div>
  );
}
