import { Pressable, type PressableProps } from "react-native";

import { Icon } from "./icon";
import type { IconName } from "./icons";
import { ThemedText } from "./themed-text";

// Design Board 06. Status filters select in secondary, depot filters in primary.
const selectedTones = {
  secondary: { container: "bg-secondary", color: "secondary-ink" },
  primary: { container: "bg-primary", color: "on-primary" },
} as const;

export function Chip({
  label,
  icon,
  selected = false,
  tone = "secondary",
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  label: string;
  icon?: IconName;
  selected?: boolean;
  tone?: keyof typeof selectedTones;
  /** Layout only. */
  className?: string;
}) {
  const t = selected ? selectedTones[tone] : { container: "bg-canvas active:bg-border", color: "ink" as const };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!props.disabled }}
      className={`h-chip flex-row items-center gap-2 rounded-full px-4 disabled:opacity-40 ${t.container} ${className ?? ""}`}
      {...props}
    >
      {icon ? <Icon name={icon} size="xs" color={t.color} /> : null}
      <ThemedText variant="label" color={t.color} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
