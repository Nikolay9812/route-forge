import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReviewActions } from "@/approvals/approvals";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { MAX_NOTE, rejectReasons } from "@/domain/shift";
import type { RejectReason } from "@/domain/types";
import { useTranslation } from "@/i18n";

// Form sheet sized to its content (no flex-1). Send a shift back with reasons and an optional note.
export default function RejectShift() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reject } = useReviewActions(id);
  const [reasons, setReasons] = useState<RejectReason[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<"offline" | "error" | null>(null);
  const ready = reasons.length > 0 || note.trim() !== "";

  const toggle = (reason: RejectReason) =>
    setReasons((current) => (current.includes(reason) ? current.filter((r) => r !== reason) : [...current, reason]));

  const onSend = async () => {
    setSending(true);
    setFailed(null);
    const failure = await reject(reasons, note.trim() || null);
    setSending(false);
    if (!failure || failure === "notEditable" || failure === "notFound") return router.back();
    setFailed(failure === "offline" ? "offline" : "error");
  };

  return (
    <View className="gap-4 bg-surface px-6 pt-8" style={{ paddingBottom: insets.bottom + 24 }}>
      <View className="gap-2">
        <ThemedText variant="heading" accessibilityRole="header">
          {t("review.rejectTitle")}
        </ThemedText>
        <ThemedText variant="body">{t("review.rejectBody")}</ThemedText>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {rejectReasons.map((reason) => (
          <Chip
            key={reason}
            label={t(`review.reasons.${reason}`)}
            selected={reasons.includes(reason)}
            onPress={() => toggle(reason)}
          />
        ))}
      </View>
      <TextField
        label={t("review.note")}
        accessibilityLabel={t("review.note")}
        value={note}
        onChangeText={setNote}
        placeholder={t("review.notePlaceholder")}
        maxLength={MAX_NOTE}
      />
      {failed ? (
        <Alert
          tone={failed === "offline" ? "offline" : "danger"}
          message={t(failed === "offline" ? "review.actionOffline" : "review.actionError")}
        />
      ) : null}
      <View className="gap-3">
        <Button title={t("review.send")} disabled={!ready} loading={sending} onPress={() => void onSend()} />
        <Button title={t("shifts.time.cancel")} variant="secondary" disabled={sending} onPress={() => router.back()} />
      </View>
    </View>
  );
}
