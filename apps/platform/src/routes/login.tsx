import { createFileRoute, redirect } from "@tanstack/react-router";

/** Auth kini berada di landing page; rute lama dipertahankan sebagai redirect. */
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
