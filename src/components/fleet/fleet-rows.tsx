import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { ThemedText } from "@/components/themed-text";
import type { ColorToken } from "@/theme";

// Full-width rows of the fleet screen: they highlight their background on press, never scale.
export function FleetRow({
  icon,
  title,
  detail,
  detailColor = "ink-muted",
  trailing,
  tone = "ink",
  strong = false,
  chevron = true,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  /** A car's paper warning shows in danger. */
  detailColor?: Extract<ColorToken, "ink-muted" | "danger">;
  trailing?: ReactNode;
  tone?: Extract<ColorToken, "ink" | "ink-muted" | "secondary-ink">;
  /** Depot headers use the label weight. */
  strong?: boolean;
  chevron?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
    >
      <Icon name={icon} color={tone === "ink" && !strong ? "ink-muted" : tone} />
      <View className="flex-1 gap-0.5">
        <ThemedText
          variant={strong ? "label" : "body"}
          color={tone}
          numberOfLines={1}
          style={strong ? undefined : { fontVariant: ["tabular-nums"] }}
        >
          {title}
        </ThemedText>
        {detail ? (
          <ThemedText variant="footnote" color={detailColor} numberOfLines={1}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron" size="sm" color="ink-muted" /> : null}
    </Pressable>
  );
}
