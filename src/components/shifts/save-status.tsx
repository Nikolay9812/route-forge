import { View } from "react-native";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import type { SaveState } from "@/shifts/today-shift";

// One quiet line under the shift form saying whether the autosave reached the server.
export function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const { t } = useTranslation();
  if (state === "idle") return null;
  const failed = state === "offline" || state === "error";

  return (
    <View className="min-h-9 flex-row items-center gap-2" accessibilityLiveRegion="polite">
      {state === "saved" ? <Icon name="check" size="xs" color="success" /> : null}
      {failed ? <Icon name={state === "offline" ? "offline" : "alert"} size="xs" color="danger" /> : null}
      <ThemedText variant="footnote" color={failed ? "danger" : "ink-muted"} className="flex-1">
        {t(`shifts.save.${state}`)}
      </ThemedText>
      {failed ? <Button title={t("shifts.save.retry")} size="sm" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
