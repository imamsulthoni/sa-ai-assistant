import { cn } from "#/lib/utils";

type Variant = "solid" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  solid:
    "bg-slate-900 text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:hover:bg-slate-900 dark:disabled:hover:bg-slate-100",
  outline:
    "border border-slate-300 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
  danger:
    "bg-rose-700 text-white shadow-xs hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500",
  success:
    "bg-emerald-700 text-white shadow-xs hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
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
        "focus-visible:ring-2 focus-visible:ring-slate-500/50 focus-visible:outline-none",
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
