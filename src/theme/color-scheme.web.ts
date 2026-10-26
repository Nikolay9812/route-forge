// On web the browser's prefers-color-scheme drives the CSS tokens, and the server-rendered first render
// can't depend on a stored choice, so there's no override and no toggle.
export function restoreColorScheme() {}

export function useToggleColorScheme(): { scheme: "light" | "dark"; toggle: () => void } | null {
  return null;
}
