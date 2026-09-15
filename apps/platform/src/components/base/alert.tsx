import { AlertCircle, Info, TriangleAlert } from "lucide-react";
import { cn } from "#/lib/utils";

type Tone = "destructive" | "warning" | "info";

const TONES: Record<Tone, string> = {
  destructive:
    "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
};

const ICONS: Record<Tone, typeof AlertCircle> = {
  destructive: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

export type AlertProps = React.ComponentProps<"div"> & { tone?: Tone };

export function Alert({ className, tone = "destructive", children, ...props }: AlertProps) {
  const Icon = ICONS[tone];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5",
        TONES[tone],
        className,
      )}
      {...props}
    >
      <Icon size={14} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
