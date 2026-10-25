import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themed-text";

// Full-width rows of the pay-rate screens: they highlight their background on press, never scale. Rows without
// onPress (started history entries) are plain and show no chevron.
export function RateRow({
  title,
  detail,
  trailing,
  strong = false,
  muted = false,
  onPress,
}: {
  title: string;
  detail?: string;
  trailing?: ReactNode;
  /** The firm default and history dates use the label weight. */
  strong?: boolean;
  muted?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View className="flex-1 gap-0.5">
        <ThemedText variant={strong ? "label" : "body"} color={muted ? "ink-muted" : "ink"} numberOfLines={1}>
          {title}
        </ThemedText>
        {detail ? (
          <ThemedText variant="footnote" numberOfLines={2}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Icon name="chevron" size="sm" color="ink-muted" /> : null}
    </>
  );
  const className = "min-h-11 flex-row items-center gap-3 px-4 py-3";
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} className={`${className} active:bg-secondary-soft`}>
      {body}
    </Pressable>
  ) : (
    <View className={className}>{body}</View>
  );
}
