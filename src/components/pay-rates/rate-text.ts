import type { PayKind, Rate } from "@/domain/types";
import { useTranslation } from "@/i18n";

import type { useFormat } from "@/components/home/format";

type Format = ReturnType<typeof useFormat>;

/** "€16.00 / h", "€130.00 per shift", and the pay type's name, in the app language. */
export function useRateText(format: Format) {
  const { t } = useTranslation();
  const amount = (rate: { kind: PayKind; amountMinor: number }) =>
    t(rate.kind === "daily" ? "payRates.perShift" : "payRates.perHour", { amount: format.money(rate.amountMinor) });
  return {
    amount,
    kind: (kind: PayKind) => t(kind === "daily" ? "payRates.daily" : "payRates.hourly"),
    /** The amount, or "Not set". */
    rateOrNotSet: (rate: Rate | null) => (rate ? amount(rate) : t("payRates.notSet")),
  };
}
