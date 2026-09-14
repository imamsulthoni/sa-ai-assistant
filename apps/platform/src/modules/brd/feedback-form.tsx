import { useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { COPY } from "#/lib/copy";

export type ClarificationQuestion = {
  id: string;
  question: string;
  options?: string[];
  required?: boolean;
};

type FeedbackFormProps = {
  questions: ClarificationQuestion[];
  round: number;
  initialAnswers?: Record<string, string>;
  onSubmit: (answers: Record<string, string>) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
};

export function FeedbackForm({
  questions,
  round,
  initialAnswers,
  onSubmit,
  onSkip,
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

  const answered = questions.filter((question) => answers[question.id]?.trim()).length;
  const missing = questions.find((question) => question.required && !answers[question.id]?.trim());

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

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {COPY.clarify.roundLabel(round)}
          </p>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              answered === questions.length
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            {COPY.clarify.answered(answered, questions.length)}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(round / 2) * 100}%` }}
          />
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          {round === 1 ? COPY.clarify.titleRound1 : COPY.clarify.titleRound2}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{COPY.clarify.subtitle}</p>
      </div>

      <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-soft md:p-6">
        {questions.map((question) => (
          <fieldset key={question.id} className="space-y-3">
            <legend className="text-sm font-medium">
              {question.question}
              {question.required && <span className="ml-1 text-destructive">*</span>}
            </legend>
            <div className="space-y-2">
              {question.options?.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent",
                    answers[question.id] === option && "border-primary/50 bg-accent/60",
                  )}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[question.id] === option && !answers[`${question.id}:custom`]}
                    onChange={() =>
                      setAnswers((prev) => {
                        const next = { ...prev, [question.id]: option };
                        delete next[`${question.id}:custom`];
                        return next;
                      })
                    }
                    className="size-4 accent-primary"
                  />
                  {option}
                </label>
              ))}
              <textarea
                value={answers[`${question.id}:custom`] ?? ""}
                onChange={(event) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [`${question.id}:custom`]: event.target.value,
                    [question.id]: event.target.value,
                  }))
                }
                placeholder={COPY.clarify.customPlaceholder}
                aria-label={`Jawaban sendiri untuk: ${question.question}`}
                className="min-h-16 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </fieldset>
        ))}

        {showMissing && missing && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle size={14} />
            {COPY.clarify.requiredError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button disabled={submitting} onClick={() => void submit()}>
            {submitting && <LoaderCircle size={15} className="animate-spin" />}
            {submitting
              ? COPY.clarify.preparing
              : round === 2
                ? COPY.clarify.submitRound2
                : COPY.clarify.submitRound1}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled={submitting} variant="outline" onClick={() => void onSkip()}>
                {COPY.clarify.skip}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{COPY.clarify.skipTooltip}</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {round === 2 ? COPY.clarify.skipHint : COPY.clarify.nextRoundHint}
        </p>
      </div>
    </section>
  );
}
