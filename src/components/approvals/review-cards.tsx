import { View } from "react-native";

import { Divider } from "@/components/divider";
import type { useFormat } from "@/components/home/format";
import { ShiftSummary } from "@/components/shifts/shift-summary";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { PayKind, Shift, ShiftChange, ShiftField } from "@/domain/types";
import { useTranslation, type TranslationKey } from "@/i18n";
import { fieldsOf } from "@/shifts/draft";

type Format = ReturnType<typeof useFormat>;

/** The shift's day, status and every value, read-only. */
export function ShiftCard({ shift, format }: { shift: Shift; format: Format }) {
  const { t } = useTranslation();
  return (
    <Surface className="gap-4 p-5">
      <View className="flex-row items-start justify-between gap-3">
        <ThemedText variant="title" className="flex-1">
          {format.longDay(shift.date)}
        </ThemedText>
        <View className="flex-row gap-1">
          {shift.corrected ? <Tag tone="info" size="sm" label={t("review.corrected")} /> : null}
          <Tag tone={shift.status} size="sm" label={t(`status.${shift.status}`)} />
        </View>
      </View>
      <ShiftSummary
        fields={fieldsOf(shift)}
        stationName={shift.depot.name}
        busPlate={shift.car.plate}
        startedAt={Date.parse(shift.startedAt)}
        end={shift.finishedAt ? Date.parse(shift.finishedAt) : Date.parse(shift.startedAt)}
        format={format}
      />
    </Surface>
  );
}

/** Hours × the rate on the shift's day, or the day rate. Personal data: only reviewers in scope ever receive it. */
export function PayCard({
  shift,
  pay,
  format,
}: {
  shift: Shift;
  pay: { kind: PayKind; amountMinor: number; payMinor: number; spesenMinor: number } | null;
  format: Format;
}) {
  const { t } = useTranslation();
  return (
    <Surface className="gap-1 p-5">
      <ThemedText variant="label">{shift.status === "approved" ? t("review.pay") : t("review.payWhenApproved")}</ThemedText>
      {pay ? (
        <>
          <ThemedText variant="number">{format.money(pay.payMinor)}</ThemedText>
          <ThemedText variant="footnote">
            {pay.kind === "daily"
              ? t("review.payDaily")
              : shift.breakMinutes
                ? t("review.payBreakdownBreak", {
                    shift: format.hours(shift.minutes ?? 0),
                    break: format.hours(shift.breakMinutes),
                    hours: format.hours(shift.workedMinutes ?? 0),
                    rate: format.money(pay.amountMinor),
                  })
                : t("review.payBreakdown", {
                    hours: format.hours(shift.workedMinutes ?? 0),
                    rate: format.money(pay.amountMinor),
                  })}
          </ThemedText>
          {pay.spesenMinor > 0 ? (
            <ThemedText variant="footnote" color="ink">
              {t("review.spesen", { amount: format.money(pay.spesenMinor) })}
            </ThemedText>
          ) : null}
        </>
      ) : (
        <ThemedText variant="body">{t("review.noRate")}</ThemedText>
      )}
    </Surface>
  );
}

const fieldLabels: Record<ShiftField, TranslationKey> = {
  depot: "shifts.fields.station",
  car: "shifts.fields.bus",
  startedAt: "edit.start",
  finishedAt: "edit.finish",
  startKm: "shifts.fields.startKm",
  endKm: "shifts.fields.endKm",
  loaded: "shifts.fields.loaded",
  returned: "shifts.fields.returned",
  pickups: "shifts.fields.pickups",
};

function changeValue(field: ShiftField, value: string | null, format: Format): string {
  if (value === null) return "—";
  if (field === "startedAt" || field === "finishedAt") return format.time(Date.parse(value));
  if (field === "depot" || field === "car") return value;
  return format.count(Number(value));
}

/** Who corrected what, grouped by save (same person, same minute). */
export function ChangesCard({ changes, format }: { changes: ShiftChange[]; format: Format }) {
  const { t } = useTranslation();
  const groups: { key: string; byName: string; at: string; items: ShiftChange[] }[] = [];
  for (const change of changes) {
    const key = `${change.byName}|${change.at.slice(0, 16)}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(change);
    else groups.push({ key, byName: change.byName, at: change.at, items: [change] });
  }

  return (
    <Surface className="gap-3 p-5">
      <ThemedText variant="title" accessibilityRole="header">
        {t("review.changes")}
      </ThemedText>
      {groups.map((group, i) => (
        <View key={group.key} className="gap-1.5">
          {i > 0 ? <Divider className="mb-1.5" /> : null}
          <ThemedText variant="footnote">
            {t("review.correctedBy", {
              name: group.byName,
              when: `${format.shortDay(group.at.slice(0, 10))}, ${format.time(Date.parse(group.at))}`,
            })}
          </ThemedText>
          {group.items.map((change) => (
            <ThemedText key={change.field} variant="caption">
              {t(fieldLabels[change.field])}: {changeValue(change.field, change.from, format)} →{" "}
              {changeValue(change.field, change.to, format)}
            </ThemedText>
          ))}
        </View>
      ))}
    </Surface>
  );
}
