import { ThemedText } from "@/components/themed-text";
import { timeUntil } from "@/domain/dates";
import { useTranslation } from "@/i18n";

type T = ReturnType<typeof useTranslation>["t"];

/** "2 years, 3 months, 5 days": every non-zero unit, largest first. */
function span(t: T, { years, months, days }: { years: number; months: number; days: number }): string {
  return (
    [
      ["years", years],
      ["months", months],
      ["days", days],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([unit, count]) => t(`documents.units.${unit}.${count === 1 ? "one" : "other"}`, { count }))
    .join(", ");
}

/** How long a document stays valid: "Valid for 1 year, 2 days", "Expires today", "Expired 3 months ago". */
export function expiryText(t: T, today: string, expiresOn: string): { text: string; expired: boolean } {
  const left = timeUntil(today, expiresOn);
  if (left.past) return { text: t("documents.expiry.expired", { time: span(t, left) }), expired: true };
  if (left.years + left.months + left.days === 0) return { text: t("documents.expiry.today"), expired: false };
  return { text: t("documents.expiry.valid", { time: span(t, left) }), expired: false };
}

// The countdown line under an ID card's or licence's expiry date: muted while valid, danger once expired.
export function ExpiryLine({ today, expiresOn, className }: { today: string; expiresOn: string; className?: string }) {
  const { t } = useTranslation();
  const { text, expired } = expiryText(t, today, expiresOn);
  return (
    <ThemedText variant="footnote" color={expired ? "danger" : "ink-muted"} className={className}>
      {text}
    </ThemedText>
  );
}
