import * as SecureStore from "expo-secure-store";
import { Appearance, useColorScheme } from "react-native";

type Scheme = "light" | "dark";

const key = "colorScheme";

/**
 * Applies the mode picked on Profile, if any, before the first render so it never flashes.
 * react-native-css listens to Appearance, so the CSS tokens, native tabs and headers all follow.
 */
export function restoreColorScheme() {
  try {
    const saved = SecureStore.getItem(key);
    if (saved === "light" || saved === "dark") Appearance.setColorScheme(saved);
  } catch {
    // Unreadable: follow the phone.
  }
}

/** Current mode and a switch to the other one, remembered on this device. */
export function useToggleColorScheme(): { scheme: Scheme; toggle: () => void } | null {
  const scheme: Scheme = useColorScheme() === "dark" ? "dark" : "light";
  function toggle() {
    const next: Scheme = scheme === "dark" ? "light" : "dark";
    Appearance.setColorScheme(next);
    // A failed save still switches for this session.
    SecureStore.setItemAsync(key, next).catch(() => {});
  }
  return { scheme, toggle };
}
