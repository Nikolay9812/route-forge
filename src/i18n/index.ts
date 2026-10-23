import { getLocales } from "expo-localization";
import { I18n, type TranslateOptions } from "i18n-js";
import { useCallback, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import bg from "./locales/bg.json";
import de from "./locales/de.json";
import en from "./locales/en.json";

export type Language = "en" | "bg" | "de";

const languages: readonly Language[] = ["en", "bg", "de"];

const i18n = new I18n({ en, bg, de });
i18n.defaultLocale = "en";
i18n.enableFallback = true;

// "onboarding.log.title" and every other leaf path of en.json.
type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

export type TranslationKey = Leaves<typeof en>;

function deviceLanguage(): Language {
  for (const { languageCode } of getLocales()) {
    const match = languages.find((l) => l === languageCode);
    if (match) return match;
  }
  return "en";
}

// Android can change the device language while the app runs, so re-read it on return to the foreground.
function subscribe(onChange: () => void) {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") onChange();
  });
  return () => subscription.remove();
}

/** The app language. On web the server can't know the browser's language, so hydration starts from "en". */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, deviceLanguage, () => "en");
}

export function useTranslation() {
  const language = useLanguage();
  const t = useCallback(
    (key: TranslationKey, options?: TranslateOptions) => i18n.t(key, { ...options, locale: language }),
    [language],
  );
  return { t, language };
}
