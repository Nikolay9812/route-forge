import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "./icon";
import type { IconName } from "./icons";
import { ThemedText } from "./themed-text";

// Stand-in for a tab whose screen is a later plan (Shifts, Pay).
export function TabPlaceholder({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 items-center justify-center gap-3 bg-canvas px-4"
      style={{ paddingTop: insets.top }}
    >
      <View className="size-ghost items-center justify-center rounded-full bg-secondary-soft">
        <Icon name={icon} color="secondary-ink" />
      </View>
      <ThemedText variant="heading" accessibilityRole="header" className="text-center">
        {title}
      </ThemedText>
      <ThemedText variant="body" className="text-center">
        {body}
      </ThemedText>
    </View>
  );
}
