import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TRANSITION_MS = 200;

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
  showClose?: boolean;
};

/**
 * Modal berbasis portal (bukan `<dialog>` native) supaya toast Sonner tetap
 * tampil di atas modal — elemen `<dialog>` native berada di top layer browser
 * yang selalu menang atas z-index apa pun. Esc, klik backdrop, dan focus trap
 * dasar ditangani manual, dengan transisi buka/tutup yang halus.
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
  showClose = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  // Tetap ter-mount selama animasi keluar, lalu dilepas.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted || !open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Hanya modal paling atas yang menutup, supaya Esc tidak menutup
      // modal induk sekaligus saat ada konfirmasi bertingkat.
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs.length && dialogs[dialogs.length - 1] !== panelRef.current) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Fokuskan elemen pertama yang bisa diinteraksi (kecuali ada autoFocus).
    if (!panelRef.current?.contains(document.activeElement)) {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open, onClose]);

  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes?.length) return;
    const list = Array.from(nodes);
    const first = list[0];
    const last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-3 transition-opacity duration-200 ease-out",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="bg-overlay absolute inset-0 backdrop-blur-xs"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onKeyDown={trapFocus}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-lg border border-border bg-card p-0 text-card-foreground shadow-2xl outline-none",
          "transition-all duration-200 ease-out",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
          SIZES[size],
          className,
        )}
      >
        {(title || description || showClose) && (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-muted px-4 py-3">
            <div className={cn("min-w-0", !title && !description && "hidden")}>
              {title && <h2 className="text-sm font-bold text-foreground">{title}</h2>}
              {description && (
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Tutup dialog"
              className={cn(
                "shrink-0",
                !title && !description && "auth-dialog-close absolute top-3 right-3",
              )}
            >
              <X size={15} />
            </Button>
          </div>
        )}

        <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-muted px-4 py-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
