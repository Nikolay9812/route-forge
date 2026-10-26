import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, View } from "react-native";

import { Divider } from "@/components/divider";
import type { useFormat } from "@/components/home/format";
import { Surface } from "@/components/surface";
import { photoTag } from "@/components/shifts/vehicle-check-card";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { ReviewItem } from "@/domain/types";
import { useTranslation } from "@/i18n";

// Shifts to review, as full-width rows that highlight on press (like Home's recent shifts). Each shows how many
// vehicle check photos the courier took, so a missing check stands out.
export function ReviewList({ items, format }: { items: ReviewItem[]; format: ReturnType<typeof useFormat> }) {
  const { t } = useTranslation();

  return (
    <Surface className="overflow-hidden">
      {items.map(({ shift, courierName }, i) => (
        <Fragment key={shift.id}>
          {i > 0 ? <Divider className="mx-4" /> : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/approvals/[id]", params: { id: shift.id } })}
            className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-canvas"
          >
            <View className="flex-1 gap-0.5">
              <ThemedText variant="label" numberOfLines={1}>
                {courierName}
              </ThemedText>
              <ThemedText variant="footnote" numberOfLines={1}>
                {format.shortDay(shift.date)} · {shift.depot.name} · {shift.car.plate}
              </ThemedText>
            </View>
            <View className="items-end gap-1">
              <ThemedText variant="label">{format.duration(shift.minutes ?? 0)}</ThemedText>
              <View className="flex-row gap-1">
                <Tag size="sm" {...photoTag(shift.photoCount, t)} />
                {shift.corrected ? <Tag tone="info" size="sm" label={t("review.corrected")} /> : null}
                <Tag tone={shift.status} size="sm" label={t(`status.${shift.status}`)} />
              </View>
            </View>
          </Pressable>
        </Fragment>
      ))}
    </Surface>
  );
}
