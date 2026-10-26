import { View } from "react-native";

import { Icon } from "@/components/icon";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import type { Bus, Station } from "@/domain/types";
import { useTranslation } from "@/i18n";
import type { EditErrors, EditFields } from "@/shifts/edit";

import { NumberField } from "./number-field";
import { StationBusPickers } from "./station-bus-pickers";

function TimeField({
  label,
  value,
  onChange,
  error,
  locked,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Shown but not editable, with a lock. */
  locked?: boolean;
}) {
  return (
    <TextField
      label={label}
      accessibilityLabel={label}
      icon="hours"
      editable={!locked}
      trailing={locked ? <Icon name="lock" size="sm" color="ink-muted" /> : undefined}
      value={value}
      onChangeText={(text) => onChange(text.replace(/[^\d:]/g, "").slice(0, 5))}
      keyboardType="numbers-and-punctuation"
      placeholder="07:30"
      error={error}
      className="flex-1"
    />
  );
}

// Every value of a finished shift: a dispatcher's correction and a courier's fix use the same form. A courier
// fixing a sent-back shift can't change its times (`lockTimes`); only reviewers correct those.
export function ShiftEditForm({
  fields,
  errors,
  stations,
  buses,
  lockTimes = false,
  onChange,
}: {
  fields: EditFields;
  errors: EditErrors;
  stations: Station[];
  buses: Bus[];
  lockTimes?: boolean;
  onChange: (change: Partial<EditFields>) => void;
}) {
  const { t } = useTranslation();
  const error = (name: keyof EditFields) => (errors[name] ? t(errors[name]) : undefined);

  return (
    <View className="gap-4">
      <StationBusPickers
        stationId={fields.stationId}
        busId={fields.busId}
        stations={stations}
        buses={buses}
        onChange={onChange}
      />
      <View className="gap-2">
        <ThemedText variant="label">{t("shifts.time.title")}</ThemedText>
        <View className="flex-row items-start gap-3">
          <TimeField
            label={t("edit.start")}
            value={fields.startTime}
            onChange={(startTime) => onChange({ startTime })}
            error={error("startTime")}
            locked={lockTimes}
          />
          <TimeField
            label={t("edit.finish")}
            value={fields.finishTime}
            onChange={(finishTime) => onChange({ finishTime })}
            error={error("finishTime")}
            locked={lockTimes}
          />
        </View>
        {lockTimes ? <ThemedText variant="footnote">{t("shifts.fix.timesLocked")}</ThemedText> : null}
      </View>
      <View className="flex-row items-start gap-3">
        <NumberField
          label={t("shifts.fields.startKm")}
          icon="km"
          value={fields.startKm}
          onChange={(startKm) => onChange({ startKm })}
          error={error("startKm")}
          className="flex-1"
        />
        <NumberField
          label={t("shifts.fields.endKm")}
          icon="km"
          value={fields.endKm}
          onChange={(endKm) => onChange({ endKm })}
          error={error("endKm")}
          className="flex-1"
        />
      </View>
      <View className="flex-row items-start gap-3">
        <NumberField
          label={t("shifts.fields.loaded")}
          icon="packages"
          value={fields.loaded}
          onChange={(loaded) => onChange({ loaded })}
          error={error("loaded")}
          className="flex-1"
        />
        <NumberField
          label={t("shifts.fields.returned")}
          value={fields.returned}
          onChange={(returned) => onChange({ returned })}
          error={error("returned")}
          className="flex-1"
        />
      </View>
      <NumberField
        label={t("shifts.fields.pickups")}
        value={fields.pickups}
        onChange={(pickups) => onChange({ pickups })}
      />
    </View>
  );
}
