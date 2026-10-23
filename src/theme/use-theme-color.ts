import { useUnstableNativeVariable } from "nativewind";

import type { ColorToken } from "./colors";

// The package types describe the web build (no arguments); the native build takes a variable name.
const useNativeVariable = useUnstableNativeVariable as unknown as (name: string) => unknown;

/**
 * Current value of a color token, for props that can't take a className
 * (Switch track, ActivityIndicator, navigation options). Follows light/dark.
 */
export function useThemeColor(token: ColorToken): string {
  return String(useNativeVariable(`--color-${token}`));
}
