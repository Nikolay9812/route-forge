import type { ColorToken } from "./colors";

// On web, styles accept CSS variables directly: the browser follows light/dark itself,
// and the value is the same on the server and the client, so hydration matches.
export function useThemeColor(token: ColorToken): string {
  return `var(--color-${token})`;
}
