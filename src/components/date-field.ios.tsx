import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";

import { ThemedText } from "./themed-text";

import type { DateFieldProps } from "./date-field";

// The SwiftUI compact picker: a native date button that opens the calendar popover. It reports a local Date,
// so the calendar day comes from its local parts (noon avoids any DST edge).
export function DateField({ label, value, onChange }: DateFieldProps) {
  const [y, m, d] = value.split("-").map(Number);
  return (
    <View className="h-field-labeled flex-row items-center justify-between gap-3 rounded-md bg-canvas px-3.5">
      <ThemedText variant="caption">{label}</ThemedText>
      <Host matchContents>
        <DatePicker
          selection={new Date(y, m - 1, d, 12)}
          displayedComponents={["date"]}
          modifiers={[datePickerStyle("compact")]}
          onDateChange={(date) => onChange(localDay(date))}
        />
      </Host>
    </View>
  );
}

function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
