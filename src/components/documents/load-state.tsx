import { View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { useTranslation } from "@/i18n";

/** Skeleton rows while documents load. */
export function DocumentsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <View className="gap-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className={`${i === 0 ? "h-16" : "h-40"} rounded-lg bg-border`} />
      ))}
    </View>
  );
}

/** Why documents didn't load, with Retry (offline gets its own message). */
export function DocumentsFailure({ failure, onRetry }: { failure: ApiFailure; onRetry: () => void }) {
  const { t } = useTranslation();
  if (failure === "firmNotSetUp") return <Notice icon="settings" title={t("firm.notSetUp.title")} body={t("firm.notSetUp.body")} />;
  return (
    <View className="gap-3">
      <Alert
        tone={failure === "offline" ? "offline" : "danger"}
        message={failure === "offline" ? t("fleet.offline") : t("documents.error")}
      />
      <Button title={t("home.retry")} variant="secondary" onPress={onRetry} />
    </View>
  );
}
