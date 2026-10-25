import { DatePickerDialog, Host } from "@expo/ui/jetpack-compose";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

import { Icon } from "./icon";
import { TextField } from "./text-field";

import type { DateFieldProps } from "./date-field";

// A read-only field that opens the Material date picker dialog. Material pickers work in UTC midnights, so the
// calendar day goes in and comes out as UTC.
export function DateField({ label, value, onChange, display }: DateFieldProps) {
  const { t } = useTranslation();
  const color = useThemeColor("primary");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${display}`} onPress={() => setOpen(true)}>
        <View pointerEvents="none">
          <TextField
            label={label}
            accessibilityLabel={label}
            value={display}
            editable={false}
            trailing={<Icon name="shifts" size="sm" color="ink-muted" />}
          />
        </View>
      </Pressable>
      {open ? (
        <Host>
          <DatePickerDialog
            initialDate={`${value}T00:00:00.000Z`}
            showVariantToggle={false}
            color={color}
            confirmButtonLabel={t("fleet.save")}
            dismissButtonLabel={t("fleet.cancel")}
            onDateSelected={(date) => {
              setOpen(false);
              onChange(date.toISOString().slice(0, 10));
            }}
            onDismissRequest={() => setOpen(false)}
          />
        </Host>
      ) : null}
    </>
  );
}
