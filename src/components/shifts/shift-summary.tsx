import { Fragment } from "react";
import { View } from "react-native";

import { Divider } from "@/components/divider";
import type { useFormat } from "@/components/home/format";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { delivered, elapsedMinutes, kmDriven, type ShiftDraft } from "@/shifts/draft";

// Grouped label/value rows for the finish sheet. `end` is the finish time shown (now, until submitted).
export function ShiftSummary({
  draft,
  end,
  format,
}: {
  draft: ShiftDraft;
  end: number;
  format: ReturnType<typeof useFormat>;
}) {
  const { t } = useTranslation();
  const start = draft.startedAt ?? end;
  const count = (value: string) => format.count(Number(value || 0));

  const rows = [
    {
      label: t("shifts.finish.time"),
      value: t("shifts.finish.timeRange", {
        start: format.time(start),
        end: format.time(end),
        duration: format.duration(elapsedMinutes(start, end)),
      }),
    },
    { label: t("shifts.fields.station"), value: draft.station ?? "" },
    { label: t("shifts.fields.bus"), value: draft.bus ?? "" },
    {
      label: t("shifts.finish.km"),
      value: t("shifts.finish.kmRange", {
        start: count(draft.startKm),
        end: count(draft.endKm),
        km: format.count(kmDriven(draft) ?? 0),
      }),
    },
    { label: t("shifts.fields.loaded"), value: count(draft.loaded) },
    { label: t("shifts.fields.delivered"), value: format.count(delivered(draft) ?? 0) },
    { label: t("shifts.fields.returned"), value: count(draft.returned) },
    { label: t("shifts.fields.pickups"), value: count(draft.pickups) },
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
