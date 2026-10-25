import { ScrollView, View } from "react-native";

import { Chip } from "@/components/chip";
import type { IconName } from "@/components/icons";
import { ThemedText } from "@/components/themed-text";

// A labeled single choice (station, bus) as one row of chips that scrolls sideways when there are many.
// Primary like depot filters on Board 06. The row bleeds to the card's edges (p-5), so chips scroll under them.
export function ChoiceChips({
  label,
  icon,
  options,
  selected,
  onSelect,
}: {
  label: string;
  icon: IconName;
  options: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <ThemedText variant="label">{label}</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        className="-mx-5"
        contentContainerClassName="gap-2 px-5"
      >
        {options.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            icon={icon}
            tone="primary"
            selected={option.id === selected}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
