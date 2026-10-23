import { Pressable, View } from "react-native";

import { Icon } from "./icon";
import { ThemedText } from "./themed-text";

// Design Board 14.
const tones = {
  success: { container: "bg-success-soft", badge: "bg-success", icon: "check", color: "ink" },
  danger: { container: "bg-danger-soft", badge: "bg-danger", icon: "alert", color: "danger" },
  offline: { container: "bg-neutral-soft", badge: "bg-neutral", icon: "offline", color: "ink" },
} as const;

export function Alert({
  message,
  tone,
  onDismiss,
  dismissLabel,
  className,
}: {
  message: string;
  tone: keyof typeof tones;
  onDismiss?: () => void;
  /** Required with onDismiss. */
  dismissLabel?: string;
  /** Layout only. */
  className?: string;
}) {
  const t = tones[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`flex-row items-center gap-2.5 rounded-md p-3 pl-3.5 ${t.container} ${className ?? ""}`}
    >
      <View className={`size-alert-badge items-center justify-center rounded-full ${t.badge}`}>
        <Icon name={t.icon} size="xs" color="white" />
      </View>
      <ThemedText variant="caption" color={t.color} className="flex-1">
        {message}
      </ThemedText>
      {onDismiss ? (
        <Pressable accessibilityRole="button" accessibilityLabel={dismissLabel} hitSlop={13} onPress={onDismiss}>
          <Icon name="close" size="sm" color="ink-muted" />
        </Pressable>
      ) : null}
    </View>
  );
}
