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
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  sky: "border-info/30 bg-info/10 text-info",
  amber: "border-warning/30 bg-warning/10 text-warning",
  emerald: "border-success/30 bg-success/10 text-success",
  dark: "border-foreground/20 bg-foreground text-background",
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
