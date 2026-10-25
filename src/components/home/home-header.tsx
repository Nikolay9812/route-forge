import { View } from "react-native";

import { PressableScale } from "@/components/pressable-scale";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

import { initials } from "./format";

function partOfDay(hour: number) {
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

export function HomeHeader({
  fullName,
  hour,
  dateLabel,
  firmName,
  onProfilePress,
}: {
  fullName: string;
  /** Firm-local hour, for the greeting. */
  hour: number;
  /** Today, formatted. Missing when the data didn't load. */
  dateLabel?: string;
  /** The firm the user works for. Missing when the data didn't load. */
  firmName?: string;
  onProfilePress: () => void;
}) {
  const { t } = useTranslation();
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  const part = partOfDay(hour);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1 gap-1">
          {dateLabel ? (
            <ThemedText variant="footnote" numberOfLines={1}>
              {dateLabel}
            </ThemedText>
          ) : null}
          <ThemedText variant="heading" accessibilityRole="header">
            {firstName ? t(`home.greeting.${part}`, { name: firstName }) : t(`home.greetingNoName.${part}`)}
          </ThemedText>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t("tabs.profile")}
          onPress={onProfilePress}
          contentClassName="size-icon-button items-center justify-center rounded-full bg-primary-soft"
        >
          <ThemedText variant="label">{initials(fullName)}</ThemedText>
        </PressableScale>
      </View>
      {firmName ? <Tag tone="role" size="sm" label={firmName} /> : null}
    </View>
  );
}
