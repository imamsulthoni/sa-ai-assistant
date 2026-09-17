import { cn } from "#/lib/utils";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "sky"
  | "amber"
  | "emerald"
  | "dark";

const TONES: Record<BadgeTone, string> = {
  neutral:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
  warning:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
  danger:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-300",
  info: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-300",
  sky: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-300",
  amber:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
  emerald:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
  dark: "border-slate-700 bg-slate-900 text-slate-100 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900",
};

export type BadgeProps = React.ComponentProps<"span"> & {
  tone?: BadgeTone;
  mono?: boolean;
};

export function Badge({
  className,
  tone = "neutral",
  mono = false,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[10px] font-semibold",
        mono && "font-mono",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
