import { View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { Shift } from "@/domain/types";
import { useTranslation, type TranslationKey } from "@/i18n";

import { clock, type useFormat } from "./format";

function Metric({ icon, value, caption }: { icon: IconName; value: string; caption: string }) {
  return (
    <View className="flex-1 gap-1">
      <Icon name={icon} size="sm" color="ink-muted" />
      <ThemedText variant="number" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText variant="footnote" numberOfLines={1}>
        {caption}
      </ThemedText>
    </View>
  );
}

const actions: Partial<Record<Shift["status"], TranslationKey>> = {
  draft: "home.today.continueShift",
  rejected: "home.today.fixShift",
};

export function TodayCard({
  shift,
  format,
  onAction,
}: {
  shift: Shift | null;
  format: ReturnType<typeof useFormat>;
  /** Log, continue or fix today's shift. */
  onAction: () => void;
}) {
  const { t } = useTranslation();
  const action = shift ? actions[shift.status] : "home.today.logShift";

  return (
    <Surface className="gap-4 p-5">
      <View className="flex-row items-center justify-between">
        <ThemedText variant="label">{t("home.today.title")}</ThemedText>
        {shift ? <Tag tone={shift.status} size="sm" label={t(`status.${shift.status}`)} /> : null}
      </View>

      {shift ? (
        <>
          <View className="flex-row gap-3">
            <Metric icon="hours" value={clock(shift.minutes)} caption={t("units.hours")} />
            <Metric icon="packages" value={format.count(shift.packages)} caption={t("units.packages")} />
            <Metric icon="km" value={format.count(shift.km)} caption={t("units.km")} />
          </View>
          <View className="flex-row items-center gap-2 border-t border-border pt-4">
            <Icon name="car" size="sm" color="ink-muted" />
            <ThemedText variant="label">{shift.carPlate}</ThemedText>
            <ThemedText variant="footnote" numberOfLines={1} className="flex-1">
              · {shift.depotName}
            </ThemedText>
          </View>
          {shift.status === "rejected" && shift.rejectionReason ? (
            <Alert tone="danger" message={t("home.today.rejected", { reason: shift.rejectionReason })} />
          ) : null}
        </>
      ) : (
        <View className="gap-2">
          <View className="mb-1 size-ghost items-center justify-center rounded-full bg-secondary-soft">
            <Icon name="shifts" color="secondary-ink" />
          </View>
          <ThemedText variant="title">{t("home.today.noShiftTitle")}</ThemedText>
          <ThemedText variant="body">{t("home.today.noShiftBody")}</ThemedText>
        </View>
      )}

      {action ? <Button title={t(action)} onPress={onAction} /> : null}
    </Surface>
  );
}
