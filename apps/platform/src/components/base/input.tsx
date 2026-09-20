import { cn } from "#/lib/utils";

export type InputProps = React.ComponentProps<"input">;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-input bg-card px-2 py-2 text-xs text-foreground transition-colors",
        "placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
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
        "w-full rounded-md border border-input bg-card px-2 py-2 text-xs leading-5 text-foreground transition-colors",
        "placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
