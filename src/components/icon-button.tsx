import { Pressable, type PressableProps } from "react-native";

import { Icon } from "./icon";
import type { IconName } from "./icons";

// Design Board 04, icon buttons.
const variants = {
  default: { container: "bg-canvas active:bg-border", color: "ink" },
  primary: { container: "bg-primary active:opacity-85", color: "on-primary" },
} as const;

export function IconButton({
  icon,
  variant = "default",
  accessibilityLabel,
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  icon: IconName;
  variant?: keyof typeof variants;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  /** Layout only. */
  className?: string;
}) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!props.disabled }}
      className={`size-icon-button items-center justify-center rounded-full disabled:opacity-40 ${v.container} ${className ?? ""}`}
      {...props}
    >
      <Icon name={icon} color={v.color} />
    </Pressable>
  );
}
