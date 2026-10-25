import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { Alert } from "@/components/alert";
import { ShiftCard } from "@/components/approvals/review-cards";
import { Button } from "@/components/button";
import { useFormat } from "@/components/home/format";
import { RejectionAlert } from "@/components/shifts/rejection-alert";
import { ShiftEditForm } from "@/components/shifts/shift-edit-form";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useTranslation, type TranslationKey } from "@/i18n";
import { correctionOf, editErrors, editFieldsOf, type EditFields } from "@/shifts/edit";
import { useOwnShift } from "@/shifts/use-own-shift";

function failureMessage(failure: ApiFailure): TranslationKey {
  if (failure === "offline") return "shifts.fix.offline";
  if (failure === "notEditable") return "shifts.fix.notEditable";
  if (failure === "invalid") return "review.invalid";
  return "shifts.fix.error";
}

// One of the courier's shifts. A rejected one shows why and can be fixed and resubmitted; others are read-only.
export default function OwnShift() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { resource, reload, resubmit } = useOwnShift(id);
  const data = resource.status === "ready" ? resource.data : null;
  const format = useFormat(data?.firm.timeZone ?? "UTC", data?.firm.currency ?? "EUR");
  // The fix being typed, started from the shift as loaded; only changed fields are sent.
  const [edit, setEdit] = useState<{ fields: EditFields; original: EditFields } | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);

  if (resource.status !== "ready") {
    return (
      <View className="flex-1 gap-3 bg-canvas p-4">
        {resource.status === "loading" ? (
          <View className="h-72 rounded-lg bg-border" />
        ) : (
          <>
            <Alert
              tone={resource.failure === "offline" ? "offline" : "danger"}
              message={t(resource.failure === "offline" ? "shifts.offline" : "shifts.fix.loadError")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
          </>
        )}
      </View>
    );
  }

  const { shift, firm, stations, buses } = resource.data;
  const rejected = shift.status === "rejected";
  const original = editFieldsOf(shift, firm.timeZone);
  const fields = edit?.fields ?? original;
  const errors = rejected ? editErrors(fields) : {};

  const onResubmit = async () => {
    if (Object.keys(errors).length > 0) return;
    setSending(true);
    setMessage(null);
    const failure = await resubmit(correctionOf(fields, edit?.original ?? original));
    setSending(false);
    if (failure) setMessage(failureMessage(failure));
    else setEdit(null);
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 p-4 pb-8"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: format.shortDay(shift.date) }} />
      {rejected ? (
        <>
          <RejectionAlert rejection={shift.rejection} />
          <Surface className="gap-4 p-5">
            <ThemedText variant="title" accessibilityRole="header">
              {t("shifts.fix.title")}
            </ThemedText>
            <ShiftEditForm
              fields={fields}
              errors={errors}
              stations={stations}
              buses={buses}
              onChange={(change) => setEdit({ fields: { ...fields, ...change }, original: edit?.original ?? original })}
            />
          </Surface>
          {message ? (
            <Alert tone={message === "shifts.fix.offline" ? "offline" : "danger"} message={t(message)} />
          ) : null}
          <Button
            title={t("shifts.fix.resubmit")}
            loading={sending}
            disabled={Object.keys(errors).length > 0}
            onPress={() => void onResubmit()}
          />
        </>
      ) : (
        <>
          <ShiftCard shift={shift} format={format} />
          {shift.status === "submitted" ? (
            <ThemedText variant="footnote">{t("shifts.submitted.waiting")}</ThemedText>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
