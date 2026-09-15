import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "#/lib/utils";
import { Button } from "#/components/base/button";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
} as const;

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
  className?: string;
  bodyClassName?: string;
};

/**
 * Modal berbasis elemen <dialog> native: Esc dan focus trap ditangani browser,
 * tanpa dependensi tambahan.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  bodyClassName,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={typeof title === "string" ? title : undefined}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-1.5rem)] rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl outline-none",
        "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
        "backdrop:bg-slate-900/60 open:flex open:max-h-[92dvh] open:flex-col",
        SIZES[size],
        className,
      )}
    >
      {(title || description) && (
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X size={15} />
          </Button>
        </div>
      )}

      <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>{children}</div>

      {footer && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          {footer}
        </div>
      )}
    </dialog>
  );
}
