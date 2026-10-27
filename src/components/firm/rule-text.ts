import type { useFormat } from "@/components/home/format";
import type { WorkRule } from "@/domain/types";
import { useTranslation } from "@/i18n";

type Format = ReturnType<typeof useFormat>;

/** A work rule as text: "30 min after 6:00 h · 45 min after 9:00 h", "€14.00 when a shift is over 8:00 h". */
export function useRuleText(format: Format) {
  const { t } = useTranslation();
  return {
    breaks: (rule: WorkRule) =>
      rule.longBreakMinutes === 0
        ? t("firmSettings.noBreak")
        : t("firmSettings.breakLine", {
            short: rule.breakMinutes,
            after: format.hours(rule.breakAfterMinutes),
            long: rule.longBreakMinutes,
            longAfter: format.hours(rule.longBreakAfterMinutes),
          }),
    spesen: (rule: WorkRule) =>
      rule.spesenMinor === 0
        ? t("firmSettings.spesenOff")
        : t("firmSettings.spesenLine", { amount: format.money(rule.spesenMinor), after: format.hours(rule.spesenAfterMinutes) }),
    /** One history line: "Break 30/45 min · Spesen €14.00". */
    summary: (rule: WorkRule) =>
      t("firmSettings.summary", {
        short: rule.breakMinutes,
        long: rule.longBreakMinutes,
        spesen: rule.spesenMinor === 0 ? t("firmSettings.spesenOff") : format.money(rule.spesenMinor),
      }),
  };
}
