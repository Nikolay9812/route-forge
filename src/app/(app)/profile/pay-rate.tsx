import { router, Stack, useLocalSearchParams } from "expo-router";
import { Fragment } from "react";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { useFormat } from "@/components/home/format";
import { RateRow } from "@/components/pay-rates/rate-row";
import { useRateText } from "@/components/pay-rates/rate-text";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { todayIn } from "@/domain/dates";
import type { PayRateEntry } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { usePayRateActions, usePayRates } from "@/pay-rates/pay-rates";

// One target's rates: the firm default (no userId) or a courier. Shows today's rate and every entry, newest
// first; only upcoming entries open the change sheet.
export default function PayRateScreen() {
  const { t } = useTranslation();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  usePayRates();
  const { data, target, name } = usePayRateActions(userId);
  const format = useFormat(data?.firm.timeZone ?? "UTC", data?.firm.currency ?? "EUR");
  const text = useRateText(format);
  const title = userId ? (name ?? "") : t("payRates.firmDefault");

  const openSheet = (id?: string) =>
    router.push({ pathname: "/profile/rate-change", params: { ...(userId ? { userId } : {}), ...(id ? { id } : {}) } });

  const entryTitle = (entry: PayRateEntry) =>
    entry.kind === "firm" || entry.amountMinor === null
      ? t("payRates.firmDefault")
      : `${text.amount({ kind: entry.kind, amountMinor: entry.amountMinor })} · ${text.kind(entry.kind)}`;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 px-4 pt-4 pb-8"
      >
        {target && data ? (
          <>
            <Surface className="gap-1 p-5">
              <ThemedText variant="footnote">{t("payRates.currentRate")}</ThemedText>
              <ThemedText variant="number" color={target.current ? "ink" : "ink-muted"}>
                {text.rateOrNotSet(target.current)}
              </ThemedText>
              {target.current ? <ThemedText variant="footnote">{text.kind(target.current.kind)}</ThemedText> : null}
              {target.followsFirm ? <ThemedText variant="footnote">{t("payRates.usesFirm")}</ThemedText> : null}
            </Surface>
            <Button title={t("payRates.schedule")} variant="secondary" onPress={() => openSheet()} />
            <View className="gap-2">
              <ThemedText variant="footnote" className="ml-1">
                {t("payRates.history")}
              </ThemedText>
              {target.entries.length === 0 ? (
                <ThemedText variant="body" color="ink-muted" className="py-6 text-center">
                  {t("payRates.historyEmpty")}
                </ThemedText>
              ) : (
                <Surface className="overflow-hidden">
                  {target.entries.map((entry, i) => (
                    <Fragment key={entry.id}>
                      {i > 0 ? <Divider className="mx-4" /> : null}
                      <RateRow
                        title={format.shortDay(entry.effectiveFrom)}
                        strong
                        muted={!entry.upcoming && !entry.current}
                        detail={`${entryTitle(entry)}\n${t("payRates.setBy", {
                          name: entry.setByName,
                          date: format.shortDay(todayIn(data.firm.timeZone, new Date(entry.setAt))),
                        })}`}
                        trailing={
                          entry.upcoming ? (
                            <Tag tone="info" size="sm" label={t("payRates.upcoming")} />
                          ) : entry.current ? (
                            <Tag tone="highlight" size="sm" label={t("payRates.current")} />
                          ) : null
                        }
                        onPress={entry.upcoming ? () => openSheet(entry.id) : undefined}
                      />
                    </Fragment>
                  ))}
                </Surface>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
