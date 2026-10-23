import { Pressable, View } from "react-native";

import { Icon } from "./icon";
import { ThemedText } from "./themed-text";

// Design Board 13.
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  accessibilityLabel,
  decrementLabel,
  incrementLabel,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** What the number counts, e.g. "Packages". */
  accessibilityLabel: string;
  decrementLabel: string;
  incrementLabel: string;
  /** Layout only. */
  className?: string;
}) {
  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ now: value, min, max }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === "increment" ? increment() : decrement())}
      className={`flex-row items-center self-start rounded-full bg-canvas p-0.75 ${className ?? ""}`}
    >
      {/* hitSlop brings the 34 buttons up to a 44 touch target. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        disabled={value <= min}
        hitSlop={5}
        onPress={decrement}
        className="size-stepper-button items-center justify-center rounded-full bg-surface active:bg-border disabled:opacity-40"
      >
        <Icon name="minus" size="xs" />
      </Pressable>
      <ThemedText variant="button" weight="extrabold" className="min-w-11.5 text-center">
        {value}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={incrementLabel}
        disabled={value >= max}
        hitSlop={5}
        onPress={increment}
        className="size-stepper-button items-center justify-center rounded-full bg-surface active:bg-border disabled:opacity-40"
      >
        <Icon name="plus" size="xs" />
      </Pressable>
    </View>
  );
}
