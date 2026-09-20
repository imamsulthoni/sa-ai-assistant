import { cn } from "#/lib/utils";

type Variant = "solid" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  /* Monochrome ink: inverts with the theme and never competes with the
     signal color, which is reserved for selection and verified state. */
  solid: "bg-foreground text-background hover:bg-foreground/90",
  outline: "border border-input bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs font-semibold",
  md: "h-8 gap-1.5 px-3.5 text-xs font-semibold",
  icon: "size-8",
  "icon-sm": "size-7",
};

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  className,
  variant = "solid",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
