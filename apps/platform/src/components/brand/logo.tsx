import { cn } from "#/lib/utils";
import { APP_NAME } from "#/lib/copy";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0 drop-shadow-sm", className)}
    >
      <defs>
        <linearGradient id="halodocs-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.58 0.2 276)" />
          <stop offset="100%" stopColor="oklch(0.5 0.16 250)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#halodocs-mark)" />
      <path
        d="M10 8.5h8.2L23 13.3v10.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 23.5v-13A1.5 1.5 0 0 1 10.5 9Z"
        fill="white"
        fillOpacity="0.94"
      />
      <path
        d="M18 8.8V13a1 1 0 0 0 1 1h4.2"
        fill="none"
        stroke="oklch(0.52 0.19 276)"
        strokeWidth="1.4"
      />
      <path
        d="M12.5 18.5h7M12.5 21h4.5"
        stroke="oklch(0.52 0.19 276)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M24.6 7.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z"
        fill="oklch(0.78 0.15 70)"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      {showWordmark && (
        <span className="font-display text-[15px] font-bold tracking-tight text-foreground">
          {APP_NAME}
        </span>
      )}
    </span>
  );
}
