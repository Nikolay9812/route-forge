import { router } from "expo-router";
import { Fragment } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { useFormat } from "@/components/home/format";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Notice } from "@/components/notice";
import { RateRow } from "@/components/pay-rates/rate-row";
import { useRateText } from "@/components/pay-rates/rate-text";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { PayRates } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { usePayRates } from "@/pay-rates/pay-rates";
import { useThemeColor } from "@/theme";

const openRate = (userId?: string) => router.push({ pathname: "/profile/pay-rate", params: userId ? { userId } : {} });

// The owner's pay rates: the firm default, then every courier with the rate they're paid today.
export default function PayRatesScreen() {
  const { t } = useTranslation();
  const spinner = useThemeColor("secondary-ink");
  const { resource, refreshing, reload } = usePayRates();
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
          <View className="h-16 rounded-lg bg-border" />
          <View className="h-40 rounded-lg bg-border" />
        </View>
      ) : resource.status === "failed" ? (
        resource.failure === "firmNotSetUp" ? (
          <Notice icon="settings" title={t("firm.notSetUp.title")} body={t("firm.notSetUp.body")} />
        ) : (
          <View className="gap-3">
            <Alert
              tone={resource.failure === "offline" ? "offline" : "danger"}
              message={resource.failure === "offline" ? t("fleet.offline") : t("payRates.error")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
          </View>
        )
      ) : (
        <RatesList data={resource.data} />
      )}
    </ScrollView>
  );
}

function RatesList({ data }: { data: PayRates }) {
  const { t } = useTranslation();
  const format = useFormat(data.firm.timeZone, data.firm.currency);
  const text = useRateText(format);
  const { firmDefault, couriers } = data;
  const missing = couriers.filter((c) => !c.current).length;

  return (
    <>
      {missing > 0 ? (
        <SectionEntrance index={0}>
          <Alert
            tone="danger"
            message={missing === 1 ? t("payRates.missingOne") : t("payRates.missingOther", { count: missing })}
          />
        </SectionEntrance>
      ) : null}
      <SectionEntrance index={1}>
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("payRates.firmDefault")}
          </ThemedText>
          <Surface className="overflow-hidden">
            <RateRow
              title={text.rateOrNotSet(firmDefault.current)}
              detail={firmDefault.current ? text.kind(firmDefault.current.kind) : undefined}
              strong
              muted={!firmDefault.current}
              trailing={firmDefault.next ? <Tag tone="info" size="sm" label={t("payRates.upcomingChange")} /> : null}
              onPress={() => openRate()}
            />
          </Surface>
        </View>
      </SectionEntrance>
      <SectionEntrance index={2}>
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("payRates.couriers")}
          </ThemedText>
          {couriers.length === 0 ? (
            <ThemedText variant="body" color="ink-muted" className="py-6 text-center">
              {t("payRates.empty")}
            </ThemedText>
          ) : (
            <Surface className="overflow-hidden">
              {couriers.map((courier, i) => (
                <Fragment key={courier.userId}>
                  {i > 0 ? <Divider className="mx-4" /> : null}
                  <RateRow
                    title={courier.name}
                    detail={courier.current ? text.amount(courier.current) : undefined}
                    trailing={
                      !courier.current ? (
                        <Tag tone="rejected" size="sm" label={t("payRates.noRateTag")} />
                      ) : courier.followsFirm ? (
                        <Tag tone="role" size="sm" label={t("payRates.firmDefault")} />
                      ) : null
                    }
                    onPress={() => openRate(courier.userId)}
                  />
                </Fragment>
              ))}
            </Surface>
          )}
        </View>
      </SectionEntrance>
    </>
  );
}
