import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";

import type { ColorToken } from "@/theme";

import { Icon } from "./icon";
import type { IconName } from "./icons";
import { textColors, ThemedText } from "./themed-text";

// Design Board 04.
const variants = {
  primary: { container: "bg-primary active:opacity-85", color: "on-primary" },
  secondary: { container: "bg-surface border border-border active:bg-canvas", color: "ink" },
  destructive: { container: "active:bg-canvas", color: "danger" },
} as const satisfies Record<string, { container: string; color: ColorToken }>;

export function Button({
  title,
  variant = "primary",
  size = "md",
  trailingIcon,
  loading = false,
  disabled,
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  title: string;
  variant?: keyof typeof variants;
  size?: "md" | "sm";
  trailingIcon?: IconName;
  loading?: boolean;
  /** Layout only (margins, flex). */
  className?: string;
}) {
  const v = variants[variant];
  // The destructive button is a lighter ghost row: 44 high, 15 text.
  const ghost = variant === "destructive" && size === "md";
  const sizeClass = ghost ? "h-ghost w-full px-6" : size === "md" ? "h-button w-full px-6" : "h-button-sm self-start px-4";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: loading }}
      disabled={disabled || loading}
      hitSlop={size === "sm" ? 5 : undefined}
      className={`flex-row items-center justify-center rounded-full disabled:opacity-40 ${sizeClass} ${v.container} ${className ?? ""}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator className={textColors[v.color]} />
      ) : (
        <ThemedText
          variant={ghost ? "body" : size === "md" ? "button" : "label"}
          weight="bold"
          color={v.color}
          numberOfLines={1}
        >
          {title}
        </ThemedText>
      )}
      {trailingIcon && !loading && size === "md" ? (
        <View className="absolute right-5">
          <Icon name={trailingIcon} color={v.color} />
        </View>
      ) : null}
    </Pressable>
  );
}
