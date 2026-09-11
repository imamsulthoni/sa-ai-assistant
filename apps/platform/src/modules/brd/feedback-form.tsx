import { useState } from "react";
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
  onSubmit: (answers: Record<string, string>) => void;
  onSkip: () => void;
};

export function FeedbackForm({ questions, round, onSubmit, onSkip }: FeedbackFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Clarification round {round} / 2
        </p>
        <h2 className="mt-2 text-2xl font-semibold">A few decisions before drafting.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose an option or write a custom answer. These answers become part of the BRD context.
        </p>
      </div>
      <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
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
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[question.id] === option}
                    onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
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
                className="min-h-16 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onSubmit(answers)}>Submit answers</Button>
          <Button variant="outline" onClick={onSkip}>
            Generate BRD directly
          </Button>
        </div>
      </div>
    </section>
  );
}
