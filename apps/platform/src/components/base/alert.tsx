import { AlertCircle, Info, TriangleAlert } from "lucide-react";
import { cn } from "#/lib/utils";

type Tone = "destructive" | "warning" | "info";

const TONES: Record<Tone, string> = {
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  info: "border-info/30 bg-info/10 text-info",
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
