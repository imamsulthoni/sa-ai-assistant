import { useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { cn } from "cn";
import { Button } from "#/components/ui/button";

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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Clarification round {round} / 2
          </p>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              answered === questions.length
                ? "bg-emerald-50 text-emerald-700"
                : "bg-muted text-muted-foreground",
            )}
          >
            {answered}/{questions.length} answered
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(round / 2) * 100}%` }}
          />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          {round === 1 ? "A few decisions before drafting." : "Almost there — final round."}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose an option or write a custom answer. These answers become part of the BRD context.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm md:p-6">
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
                    checked={
                      answers[question.id] === option &&
                      !answers[`${question.id}:custom`]
                    }
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
                placeholder="Isi sendiri…"
                aria-label={`Custom answer for: ${question.question}`}
                className="min-h-16 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </fieldset>
        ))}

        {showMissing && missing && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle size={14} />
            Please answer all required questions before continuing.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button disabled={submitting} onClick={() => void submit()}>
            {submitting && <LoaderCircle size={15} className="animate-spin" />}
            {submitting ? "Preparing BRD…" : round === 2 ? "Generate BRD" : "Continue"}
          </Button>
          <Button disabled={submitting} variant="outline" onClick={() => void onSkip()}>
            Generate with assumptions
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {round === 2
            ? "Final round — remaining gaps will be recorded as explicit assumptions in the BRD."
            : "You'll get one more round of follow-up questions if anything is still unclear."}
        </p>
      </div>
    </section>
  );
}