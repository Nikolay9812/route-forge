import { View } from "react-native";

import { Icon } from "./icon";
import type { IconName } from "./icons";
import { Surface } from "./surface";
import { ThemedText } from "./themed-text";

// A calm card for states that aren't errors: "coming soon for your role", "firm not set up yet".
export function Notice({
  icon,
  title,
  body,
  className,
}: {
  icon: IconName;
  title: string;
  body: string;
  /** Layout only. */
  className?: string;
}) {
  return (
    <Surface className={`gap-2 p-5 ${className ?? ""}`}>
      <View className="mb-1 size-ghost items-center justify-center rounded-full bg-secondary-soft">
        <Icon name={icon} color="secondary-ink" />
      </View>
      <ThemedText variant="title">{title}</ThemedText>
      <ThemedText variant="body">{body}</ThemedText>
    </Surface>
  );
}
