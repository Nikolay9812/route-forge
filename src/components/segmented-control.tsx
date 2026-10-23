import { Pressable, View } from "react-native";

import { Icon } from "./icon";
import type { IconName } from "./icons";
import { ThemedText } from "./themed-text";

// Design Board 12.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
  /** Layout only. */
  className?: string;
}) {
  return (
    <View accessibilityRole="tablist" className={`flex-row gap-0.5 rounded-full bg-canvas p-1 ${className ?? ""}`}>
      {options.map((option) => {
        const selected = option.value === value;
        const color = selected ? "on-inverse" : "ink";
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={`h-segment flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-2 ${
              selected ? "bg-inverse" : "active:bg-border"
            }`}
          >
            {option.icon ? <Icon name={option.icon} size="sm" color={color} /> : null}
            <ThemedText variant="label" color={color} numberOfLines={1}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
