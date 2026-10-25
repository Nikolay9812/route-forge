import { useState } from "react";

import { isDay } from "@/domain/pay-rates";
import { useTranslation } from "@/i18n";

import { TextField } from "./text-field";

export type DateFieldProps = {
  label: string;
  /** A calendar day, "YYYY-MM-DD". */
  value: string;
  onChange: (day: string) => void;
  /** The value as people read it ("Sat, 1 Nov"), for the native fields. */
  display: string;
};

// Web (and any platform without a native picker): the day typed as YYYY-MM-DD. iOS and Android use the native
// pickers from @expo/ui in date-field.ios.tsx and date-field.android.tsx.
export function DateField({ label, value, onChange }: DateFieldProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  return (
    <TextField
      label={label}
      accessibilityLabel={label}
      value={text}
      onChangeText={(next) => {
        setText(next);
        if (isDay(next)) onChange(next);
      }}
      placeholder="YYYY-MM-DD"
      autoCorrect={false}
      maxLength={10}
      error={text !== "" && !isDay(text) ? t("payRates.sheet.dateInvalid") : undefined}
    />
  );
}
