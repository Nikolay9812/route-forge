import { useMemo } from "react";

import { dateAtNoon } from "@/domain/dates";
import { useTranslation, type Language } from "@/i18n";

const locales: Record<Language, string> = { en: "en-GB", bg: "bg-BG", de: "de-DE" };

/** "Maria Ivanova" → "MI", "Maria" → "M". */
export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/** "7:30" for a shift's working time. */
export function clock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Money, hours and calendar days in the app language. Calendar days format in the firm's timezone. */
export function useFormat(timeZone: string, currency: string) {
  const { t, language } = useTranslation();
  return useMemo(() => {
    const locale = locales[language];
    const money = new Intl.NumberFormat(locale, { style: "currency", currency });
    const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const count = new Intl.NumberFormat(locale);
    const longDay = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" });
    const shortDay = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short" });
    const monthName = new Intl.DateTimeFormat(locale, { timeZone, month: "long" });
    return {
      money: (minor: number) => money.format(minor / 100),
      hours: (minutes: number) => hours.format(minutes / 60),
      count: (value: number) => count.format(value),
      duration: (minutes: number) =>
        t("units.duration", { hours: Math.floor(minutes / 60), minutes: minutes % 60 }),
      longDay: (date: string) => longDay.format(dateAtNoon(date)),
      shortDay: (date: string) => shortDay.format(dateAtNoon(date)),
      month: (date: string) => {
        const name = monthName.format(dateAtNoon(date));
        return name.charAt(0).toUpperCase() + name.slice(1);
      },
    };
  }, [t, language, timeZone, currency]);
}
