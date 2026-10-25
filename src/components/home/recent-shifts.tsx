import { Fragment } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { Shift } from "@/domain/types";
import { useTranslation } from "@/i18n";

import type { useFormat } from "./format";

// Full-width rows highlight their background on press instead of scaling.
export function RecentShifts({
  shifts,
  format,
  onSeeAll,
  onPressShift,
}: {
  shifts: Shift[];
  format: ReturnType<typeof useFormat>;
  onSeeAll: () => void;
  onPressShift: (shift: Shift) => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-4">
        <ThemedText variant="title" accessibilityRole="header">
          {t("home.recent.title")}
        </ThemedText>
        <Button title={t("home.recent.seeAll")} size="sm" variant="secondary" onPress={onSeeAll} />
      </View>
      <Surface className="overflow-hidden">
        {shifts.map((shift, i) => (
          <Fragment key={shift.id}>
            {i > 0 ? <Divider className="mx-4" /> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => onPressShift(shift)}
              className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-canvas"
            >
              <View className="flex-1 gap-0.5">
                <ThemedText variant="label" numberOfLines={1}>
                  {format.shortDay(shift.date)}
                </ThemedText>
                <ThemedText variant="footnote" numberOfLines={1}>
                  {shift.carPlate} · {shift.depotName}
                </ThemedText>
              </View>
              <View className="items-end gap-1">
                <ThemedText variant="label">{format.duration(shift.minutes)}</ThemedText>
                <Tag tone={shift.status} size="sm" label={t(`status.${shift.status}`)} />
              </View>
            </Pressable>
          </Fragment>
        ))}
      </Surface>
    </View>
  );
}
