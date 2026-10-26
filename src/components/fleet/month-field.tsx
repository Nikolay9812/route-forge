import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

/** "2027-03" moved by n months. */
function shift(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + n, 1));
  return date.toISOString().slice(0, 7);
}

// A month that may be unset, like a TÜV sticker's: "Add month" until one is picked (starting from `initial`), then
// the month with previous/next buttons and a clear button. Looks like `OptionalDateField`.
export function MonthField({
  label,
  value,
  display,
  initial,
  onChange,
}: {
  label: string;
  /** "YYYY-MM". */
  value: string | null;
  /** The month as shown ("March 2027"). */
  display: string;
  initial: string;
  onChange: (month: string | null) => void;
}) {
  const { t } = useTranslation();
  if (value === null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${t("fleet.papers.addMonth")}`}
        onPress={() => onChange(initial)}
        className="h-field-labeled flex-row items-center justify-between gap-3 rounded-md bg-canvas px-3.5 active:bg-border"
      >
        <ThemedText variant="caption">{label}</ThemedText>
        <View className="flex-row items-center gap-1.5">
          <Icon name="plus" size="xs" color="secondary-ink" />
          <ThemedText variant="label" color="secondary-ink">
            {t("fleet.papers.addMonth")}
          </ThemedText>
        </View>
      </Pressable>
    );
  }
  return (
    <View className="flex-row items-center gap-2">
      <View
        className="h-field-labeled flex-1 flex-row items-center gap-1 rounded-md bg-canvas pl-3.5 pr-1"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: display }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => onChange(shift(value, event.nativeEvent.actionName === "increment" ? 1 : -1))}
      >
        <View className="flex-1 gap-0.5">
          <ThemedText variant="caption">{label}</ThemedText>
          <ThemedText variant="body">{display}</ThemedText>
        </View>
        <IconButton
          icon="back"
          size="sm"
          accessibilityLabel={t("fleet.papers.previousMonth")}
          onPress={() => onChange(shift(value, -1))}
        />
        <IconButton
          icon="chevron"
          size="sm"
          accessibilityLabel={t("fleet.papers.nextMonth")}
          onPress={() => onChange(shift(value, 1))}
        />
      </View>
      <IconButton
        icon="close"
        size="sm"
        accessibilityLabel={t("documents.clearDate", { label })}
        onPress={() => onChange(null)}
      />
    </View>
  );
}
