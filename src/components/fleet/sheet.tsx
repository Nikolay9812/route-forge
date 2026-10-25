import { router } from "expo-router";
import { useState, type PropsWithChildren } from "react";
import { Alert as NativeAlert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ApiFailure } from "@/api/client";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

// Form sheet sized to its content (no flex-1), shared by the depot and car sheets.
export function FleetSheet({ title, body, children }: PropsWithChildren<{ title: string; body?: string }>) {
  const insets = useSafeAreaInsets();
  return (
    <View className="gap-4 bg-surface px-6 pt-8" style={{ paddingBottom: insets.bottom + 24 }}>
      <View className="gap-2">
        <ThemedText variant="heading" accessibilityRole="header">
          {title}
        </ThemedText>
        {body ? <ThemedText variant="body">{body}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Runs one save at a time. Success closes the sheet; a failure stays on screen with what was typed, and the
 * caller gets the code to place (e.g. `taken` under the field).
 */
export function useSheetSave() {
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const run = async (save: () => Promise<ApiFailure | null>) => {
    setSaving(true);
    setFailure(null);
    const result = await save();
    setSaving(false);
    if (!result) return router.back();
    setFailure(result);
  };

  return { saving, failure, run, clear: () => setFailure(null) };
}

/** The native "are you sure" before archiving. */
export function useConfirmArchive() {
  const { t } = useTranslation();
  return (title: string, body: string, onConfirm: () => void) =>
    NativeAlert.alert(title, body, [
      { text: t("fleet.cancel"), style: "cancel" },
      { text: t("fleet.archiveConfirm"), style: "destructive", onPress: onConfirm },
    ]);
}
