import type { ErrorBoundaryProps } from "expo-router";
import { View } from "react-native";

import { useTranslation } from "@/i18n";

import { Button } from "./button";
import { Notice } from "./notice";

// What a render crash shows instead of a blank screen. It renders outside the root providers (no Clerk, fonts maybe
// not loaded yet), so it uses only tokens, translations and plain primitives. The error itself is never shown: its
// message can quote personal data.
export function CrashScreen({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-center gap-4 bg-canvas p-4">
      <Notice icon="alert" title={t("app.crash.title")} body={t("app.crash.body")} />
      <Button title={t("app.crash.retry")} onPress={retry} />
    </View>
  );
}
