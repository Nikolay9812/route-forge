import { Fragment } from "react";
import { View } from "react-native";

import { Divider } from "@/components/divider";
import type { useFormat } from "@/components/home/format";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { deliveredOf, elapsedMinutes, kmDrivenOf, type ShiftFields } from "@/shifts/draft";

// Grouped label/value rows for the finish sheet. `end` is the finish time shown (now, until submitted).
export function ShiftSummary({
  fields,
  stationName,
  busPlate,
  startedAt,
  end,
  format,
}: {
  fields: ShiftFields;
  stationName: string;
  busPlate: string;
  /** UTC milliseconds. */
  startedAt: number;
  end: number;
  format: ReturnType<typeof useFormat>;
}) {
  const { t } = useTranslation();
  const count = (value: string) => format.count(Number(value || 0));

  const rows = [
    {
      label: t("shifts.finish.time"),
      value: t("shifts.finish.timeRange", {
        start: format.time(startedAt),
        end: format.time(end),
        duration: format.hours(elapsedMinutes(startedAt, end)),
      }),
    },
    { label: t("shifts.fields.station"), value: stationName },
    { label: t("shifts.fields.bus"), value: busPlate },
    {
      label: t("shifts.finish.km"),
      value: t("shifts.finish.kmRange", {
        start: count(fields.startKm),
        end: count(fields.endKm),
        km: format.count(kmDrivenOf(fields) ?? 0),
      }),
    },
    { label: t("shifts.fields.loaded"), value: count(fields.loaded) },
    { label: t("shifts.fields.delivered"), value: format.count(deliveredOf(fields) ?? 0) },
    { label: t("shifts.fields.returned"), value: count(fields.returned) },
    { label: t("shifts.fields.pickups"), value: count(fields.pickups) },
  ];

  return (
    <View className="rounded-md bg-canvas">
      {rows.map((row, i) => (
        <Fragment key={row.label}>
          {i > 0 ? <Divider className="mx-4" /> : null}
          <View className="min-h-11 flex-row items-center gap-3 px-4 py-2.5">
            <ThemedText variant="body" className="flex-1">
              {row.label}
            </ThemedText>
            <ThemedText variant="label" className="shrink text-right">
              {row.value}
            </ThemedText>
          </View>
        </Fragment>
      ))}
    </View>
  );
}
