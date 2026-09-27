import { cn } from "#/lib/utils";
import { APP_NAME } from "#/lib/copy";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("logo-mark size-8 shrink-0 drop-shadow-sm", className)}
    >
      <rect width="32" height="32" rx="9" fill="#111827" />
      <path
        d="M10 8.5h8.2L23 13.3v10.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 23.5v-13A1.5 1.5 0 0 1 10.5 9Z"
        fill="white"
        fillOpacity="0.94"
      />
      <path
        d="M18 8.8V13a1 1 0 0 0 1 1h4.2"
        fill="none"
        stroke="#111827"
        strokeWidth="1.4"
      />
      <path
        d="M12.5 18.5h7M12.5 21h4.5"
        stroke="#111827"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M24.6 7.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z"
        fill="#ffffff"
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
