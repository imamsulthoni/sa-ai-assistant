export const THEME_STORAGE_KEY = "halodocs-theme";

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: string | null | undefined) {
  const dark = theme === "dark" || (theme !== "light" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  if (theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage tidak tersedia; tema tetap diterapkan untuk sesi ini.
    }
  }
}

export function applyStoredTheme() {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage tidak tersedia; pakai preferensi sistem.
  }
  applyTheme(stored ?? "system");
}