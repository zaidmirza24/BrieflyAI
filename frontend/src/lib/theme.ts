export type Theme = "light" | "dark"

const STORAGE_KEY = "theme"

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === "light" || value === "dark" ? value : null
}

export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function applyTheme(theme: Theme | null): void {
  if (theme) {
    document.documentElement.setAttribute("data-theme", theme)
  } else {
    document.documentElement.removeAttribute("data-theme")
  }
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export function getEffectiveTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
