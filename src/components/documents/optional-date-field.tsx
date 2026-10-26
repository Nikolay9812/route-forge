import { Pressable, View } from "react-native";

import { DateField } from "@/components/date-field";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

// A date that may be unset: "Add date" until one is picked (starting from `initial`), then the native picker with
// a clear button. The error shows under it like a text field's.
export function OptionalDateField({
  label,
  value,
  display,
  initial,
  error,
  onChange,
}: {
  label: string;
  value: string | null;
  display: string;
  /** The day the picker starts on when adding. */
  initial: string;
  error?: string;
  onChange: (day: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      {value === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${t("documents.addDate")}`}
          onPress={() => onChange(initial)}
          className="h-field-labeled flex-row items-center justify-between gap-3 rounded-md bg-canvas px-3.5 active:bg-border"
        >
          <ThemedText variant="caption">{label}</ThemedText>
          <View className="flex-row items-center gap-1.5">
            <Icon name="plus" size="xs" color="secondary-ink" />
            <ThemedText variant="label" color="secondary-ink">
              {t("documents.addDate")}
            </ThemedText>
          </View>
        </Pressable>
      ) : (
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <DateField label={label} value={value} display={display} onChange={onChange} />
          </View>
          <IconButton
            icon="close"
            size="sm"
            accessibilityLabel={t("documents.clearDate", { label })}
            onPress={() => onChange(null)}
          />
        </View>
      )}
      {error ? (
        <ThemedText variant="footnote" weight="regular" color="danger" className="ml-1">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
