import { cn } from "#/lib/utils";

export type InputProps = React.ComponentProps<"input">;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 transition-colors",
        "placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none",
        "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-400",
        className,
      )}
      {...props}
    />
  );
}

export type TextareaProps = React.ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs leading-5 text-slate-900 transition-colors",
        "placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none",
        "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-400",
        className,
      )}
      {...props}
    />
  );
}
