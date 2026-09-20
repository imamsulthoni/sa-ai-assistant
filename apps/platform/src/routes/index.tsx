import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "#/modules/landing/landing-page";

/**
 * Modal login/register hanya dibuka oleh aksi pengunjung (tombol Masuk,
 * Daftar, atau CTA). Redirect dari rute lain mendarat di halaman ini tanpa
 * memunculkan modal.
 */
export const Route = createFileRoute("/")({
  component: LandingPage,
});
