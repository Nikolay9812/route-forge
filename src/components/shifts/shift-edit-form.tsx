import { View } from "react-native";

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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <TextField
      label={label}
      accessibilityLabel={label}
      icon="hours"
      value={value}
      onChangeText={(text) => onChange(text.replace(/[^\d:]/g, "").slice(0, 5))}
      keyboardType="numbers-and-punctuation"
      placeholder="07:30"
      error={error}
      className="flex-1"
    />
  );
}

// Every value of a finished shift, editable: a dispatcher's correction and a courier's fix use the same form.
export function ShiftEditForm({
  fields,
  errors,
  stations,
  buses,
  onChange,
}: {
  fields: EditFields;
  errors: EditErrors;
  stations: Station[];
  buses: Bus[];
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
          />
          <TimeField
            label={t("edit.finish")}
            value={fields.finishTime}
            onChange={(finishTime) => onChange({ finishTime })}
            error={error("finishTime")}
          />
        </View>
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
