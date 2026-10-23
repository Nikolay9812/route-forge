import { useState } from "react";
import { TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

const LENGTH = 6;

/**
 * Six code boxes over one transparent TextInput, so paste and SMS/email autofill work natively.
 * Tapping anywhere on the boxes focuses the input underneath.
 */
export function CodeInput({
  value,
  onChangeText,
  error,
  accessibilityLabel,
  editable = true,
}: {
  value: string;
  onChangeText: (code: string) => void;
  error?: boolean;
  accessibilityLabel: string;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="flex-row gap-2">
      {Array.from({ length: LENGTH }, (_, i) => {
        const active = focused && i === Math.min(value.length, LENGTH - 1);
        const border = error ? "border-danger" : active ? "border-secondary-ink" : "border-transparent";
        return (
          <View
            key={i}
            className={`h-field flex-1 items-center justify-center rounded-md border-[1.5px] bg-canvas ${border}`}
          >
            <ThemedText variant="heading">{value[i] ?? ""}</ThemedText>
          </View>
        );
      })}
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        editable={editable}
        caretHidden
        accessibilityLabel={accessibilityLabel}
        className="absolute inset-0 text-transparent opacity-0"
      />
    </View>
  );
}

export const CODE_LENGTH = LENGTH;
