import { toast } from "sonner";

type ToastOptions = Parameters<typeof toast.success>[1];

/**
 * Small wrapper around Sonner so screens share one notification vocabulary
 * (and one place to change defaults later).
 */
export const notify = {
  success(message: string, options?: ToastOptions) {
    return toast.success(message, options);
  },
  error(message: string, options?: ToastOptions) {
    return toast.error(message, options);
  },
  info(message: string, options?: ToastOptions) {
    return toast.info(message, options);
  },
  warning(message: string, options?: ToastOptions) {
    return toast.warning(message, options);
  },
  loading(message: string, options?: ToastOptions) {
    return toast.loading(message, options);
  },
  dismiss(id?: string | number) {
    toast.dismiss(id);
  },
};

export { toast };
