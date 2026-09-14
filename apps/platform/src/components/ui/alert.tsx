import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "#/lib/utils";

const alertVariants = cva(
  "relative flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        info: "border-info/25 bg-info/8 text-foreground",
        success: "border-success/25 bg-success/8 text-foreground",
        warning: "border-warning/30 bg-warning/10 text-foreground",
        destructive: "border-destructive/30 bg-destructive/6 text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const ICONS = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
} as const;

function Alert({
  className,
  variant = "default",
  children,
  showIcon = true,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants> & { showIcon?: boolean }) {
  const Icon = ICONS[variant ?? "default"];
  const iconColor =
    variant === "destructive"
      ? "text-destructive"
      : variant === "warning"
        ? "text-warning-foreground"
        : variant === "success"
          ? "text-success"
          : "text-info";

  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {showIcon && <Icon size={16} className={cn("mt-0.5 shrink-0", iconColor)} />}
      <div className="min-w-0 flex-1 leading-6">{children}</div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("font-medium", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
