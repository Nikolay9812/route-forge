import { createContext, use, useSyncExternalStore, type PropsWithChildren } from "react";

/** Plus Jakarta Sans has no Cyrillic, so Bulgarian text uses Manrope. */
export type FontScript = "latin" | "cyrillic";

const FontScriptContext = createContext<FontScript>("latin");

export function FontScriptProvider({ script, children }: PropsWithChildren<{ script: FontScript }>) {
  return <FontScriptContext value={script}>{children}</FontScriptContext>;
}

export function useFontScript(): FontScript {
  return use(FontScriptContext);
}

function deviceFontScript(): FontScript {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale.toLowerCase().startsWith("bg") ? "cyrillic" : "latin";
}

const noSubscription = () => () => {};

// Until i18n exists, the device locale decides. The i18n plan switches this to the app language.
// On web the server can't know the browser's locale, so hydration starts from "latin" and then switches.
export function useDeviceFontScript(): FontScript {
  return useSyncExternalStore(noSubscription, deviceFontScript, () => "latin");
}
