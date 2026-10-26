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
    const tenths = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const count = new Intl.NumberFormat(locale);
    const longDay = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" });
    const shortDay = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short" });
    const fullDay = new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", year: "numeric" });
    const monthName = new Intl.DateTimeFormat(locale, { timeZone, month: "long" });
    const monthYear = new Intl.DateTimeFormat(locale, { timeZone, month: "long", year: "numeric" });
    const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" });
    const timeOfDay = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return {
      money: (minor: number) => money.format(minor / 100),
      hours: (minutes: number) => hours.format(minutes / 60),
      /** Always one decimal ("7,0"), so a column of hours lines up. */
      hoursTenths: (minutes: number) => tenths.format(minutes / 60),
      count: (value: number) => count.format(value),
      duration: (minutes: number) =>
        t("units.duration", { hours: Math.floor(minutes / 60), minutes: minutes % 60 }),
      longDay: (date: string) => longDay.format(dateAtNoon(date)),
      shortDay: (date: string) => shortDay.format(dateAtNoon(date)),
      /** "12 Mar 1994": birth dates and document validity, where the year matters. */
      fullDay: (date: string) => fullDay.format(dateAtNoon(date)),
      /** "Mo", "Mon", "пн": the calendar's column heads, without German's trailing dot. */
      weekday: (date: string) => weekday.format(dateAtNoon(date)).replace(/\.$/, ""),
      /** "Oktober" in the current year, "Dezember 2025" in any other. */
      calendarMonth: (date: string, today: string) => {
        const name = (date.slice(0, 4) === today.slice(0, 4) ? monthName : monthYear).format(dateAtNoon(date));
        return name.charAt(0).toUpperCase() + name.slice(1);
      },
      /** "07:30" for a UTC timestamp, in the firm's timezone. */
      time: (at: number) => timeOfDay.format(at),
      month: (date: string) => {
        const name = monthName.format(dateAtNoon(date));
        return name.charAt(0).toUpperCase() + name.slice(1);
      },
    };
  }, [t, language, timeZone, currency]);
}
