import { router } from "expo-router";
import { Fragment, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { ActionSheet } from "@/components/action-sheet";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { useRuleText } from "@/components/firm/rule-text";
import { useFormat } from "@/components/home/format";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Icon } from "@/components/icon";
import { RateRow } from "@/components/pay-rates/rate-row";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { ApiFailure } from "@/api/client";
import { todayIn } from "@/domain/dates";
import { CURRENCIES, TIME_ZONES } from "@/domain/firm";
import type { FirmSettings } from "@/domain/types";
import { useFirmActions, useFirmSettings } from "@/firm/firm-settings";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

const openSheet = (id?: string) => router.push({ pathname: "/profile/rules-change", params: id ? { id } : {} });

// The owner's Firm settings: name (from Clerk), currency and timezone (editable until the firm's first shift),
// and the dated break and Spesen rules with their history; only upcoming entries open the sheet.
export default function FirmSettingsScreen() {
  const { t } = useTranslation();
  const spinner = useThemeColor("secondary-ink");
  const { resource, refreshing, reload } = useFirmSettings();
  const data = resource.status === "ready" ? resource.data : null;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pt-4 pb-8"
      refreshControl={
        data ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} />
        ) : undefined
      }
    >
      {resource.status === "loading" ? (
        <View className="gap-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View className="h-36 rounded-lg bg-border" />
          <View className="h-28 rounded-lg bg-border" />
        </View>
      ) : resource.status === "failed" ? (
        <View className="gap-3">
          <Alert
            tone={resource.failure === "offline" ? "offline" : "danger"}
            message={resource.failure === "offline" ? t("fleet.offline") : t("firmSettings.error")}
          />
          <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
        </View>
      ) : (
        <Settings data={resource.data} />
      )}
    </ScrollView>
  );
}

function Settings({ data }: { data: FirmSettings }) {
  const { t } = useTranslation();
  const format = useFormat(data.timeZone, data.currency);
  const text = useRuleText(format);
  const actions = useFirmActions();
  const [picking, setPicking] = useState<"currency" | "timeZone" | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const pick = async (input: { currency: string; timeZone: string }) => {
    setFailure(null);
    setFailure(await actions.saveSettings(input));
  };

  const options = picking === "currency" ? CURRENCIES : TIME_ZONES;
  const shown = data.rule ?? data.next;

  return (
    <>
      <SectionEntrance index={0}>
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("firmSettings.general")}
          </ThemedText>
          <Surface className="overflow-hidden">
            <RateRow title={t("firmSettings.name")} trailing={<Value text={data.name} />} />
            <Divider className="mx-4" />
            <RateRow
              title={t("firmSettings.currency")}
              trailing={<Value text={data.currency} locked={data.locked} />}
              onPress={data.locked ? undefined : () => setPicking("currency")}
            />
            <Divider className="mx-4" />
            <RateRow
              title={t("firmSettings.timeZone")}
              trailing={<Value text={data.timeZone} locked={data.locked} />}
              onPress={data.locked ? undefined : () => setPicking("timeZone")}
            />
          </Surface>
          {data.locked ? (
            <ThemedText variant="footnote" className="ml-1">
              {t("firmSettings.locked")}
            </ThemedText>
          ) : null}
          {failure ? (
            <Alert
              tone={failure === "offline" ? "offline" : "danger"}
              message={failure === "offline" ? t("fleet.saveOffline") : t("fleet.saveError")}
            />
          ) : null}
        </View>
      </SectionEntrance>

      <SectionEntrance index={1}>
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("firmSettings.rules")}
          </ThemedText>
          {shown ? (
            <Surface className="gap-3 p-5">
              <View className="gap-0.5">
                <ThemedText variant="label">{t("firmSettings.break")}</ThemedText>
                <ThemedText variant="body">{text.breaks(shown)}</ThemedText>
              </View>
              <View className="gap-0.5">
                <ThemedText variant="label">{t("firmSettings.spesen")}</ThemedText>
                <ThemedText variant="body">{text.spesen(shown)}</ThemedText>
              </View>
              {/* Nothing in force yet: the card shows the first scheduled rule and when it starts. */}
              {!data.rule && data.next ? (
                <Tag tone="info" size="sm" label={t("firmSettings.starts", { date: format.shortDay(data.next.effectiveFrom) })} />
              ) : data.next ? (
                <Tag
                  tone="info"
                  size="sm"
                  label={t("firmSettings.nextChange", { date: format.shortDay(data.next.effectiveFrom) })}
                />
              ) : null}
            </Surface>
          ) : (
            <Alert tone="danger" message={t("firmSettings.notSet")} />
          )}
        </View>
      </SectionEntrance>

      <Button title={t("payRates.schedule")} variant="secondary" onPress={() => openSheet()} />

      {data.entries.length > 0 ? (
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("payRates.history")}
          </ThemedText>
          <Surface className="overflow-hidden">
            {data.entries.map((entry, i) => (
              <Fragment key={entry.id}>
                {i > 0 ? <Divider className="mx-4" /> : null}
                <RateRow
                  title={format.shortDay(entry.effectiveFrom)}
                  strong
                  muted={!entry.upcoming && !entry.current}
                  detail={`${text.summary(entry)}\n${t("payRates.setBy", {
                    name: entry.setByName,
                    date: format.shortDay(todayIn(data.timeZone, new Date(entry.setAt))),
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
        </View>
      ) : null}

      <ActionSheet
        visible={picking !== null}
        title={picking === "currency" ? t("firmSettings.currency") : t("firmSettings.timeZone")}
        actions={options.map((value) => ({
          label: value,
          onPress: () =>
            void pick(
              picking === "currency"
                ? { currency: value, timeZone: data.timeZone }
                : { currency: data.currency, timeZone: value },
            ),
        }))}
        cancelLabel={t("fleet.cancel")}
        onClose={() => setPicking(null)}
      />
    </>
  );
}

function Value({ text, locked = false }: { text: string; locked?: boolean }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <ThemedText variant="body" color="ink-muted" numberOfLines={1}>
        {text}
      </ThemedText>
      {locked ? <Icon name="lock" size="sm" color="ink-muted" /> : null}
    </View>
  );
}
