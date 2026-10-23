import { createContext, use, type PropsWithChildren } from "react";

import type { Language } from "@/i18n";

/** Plus Jakarta Sans has no Cyrillic, so Bulgarian text uses Manrope. */
export type FontScript = "latin" | "cyrillic";

const FontScriptContext = createContext<FontScript>("latin");

export function FontScriptProvider({ script, children }: PropsWithChildren<{ script: FontScript }>) {
  return <FontScriptContext value={script}>{children}</FontScriptContext>;
}

export function useFontScript(): FontScript {
  return use(FontScriptContext);
}

/** The app language picks the script, so Bulgarian text always renders in Manrope. */
export function fontScriptFor(language: Language): FontScript {
  return language === "bg" ? "cyrillic" : "latin";
}
