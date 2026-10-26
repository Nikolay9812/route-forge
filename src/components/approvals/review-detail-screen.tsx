import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { useApprovalDetail } from "@/approvals/approvals";
import { Alert } from "@/components/alert";
import { ChangesCard, PayCard, ShiftCard } from "@/components/approvals/review-cards";
import { Button } from "@/components/button";
import { useFormat } from "@/components/home/format";
import { RejectionAlert } from "@/components/shifts/rejection-alert";
import { ShiftEditForm } from "@/components/shifts/shift-edit-form";
import { VehicleCheckCard } from "@/components/shifts/vehicle-check-card";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useTranslation, type TranslationKey } from "@/i18n";
import { correctionOf, editErrors, editFieldsOf, type EditFields } from "@/shifts/edit";

function failureMessage(failure: ApiFailure): TranslationKey {
  if (failure === "offline") return "review.actionOffline";
  if (failure === "notEditable" || failure === "notFound") return "review.changedMeanwhile";
  if (failure === "invalid") return "review.invalid";
  return "review.actionError";
}

// One shift for a dispatcher or owner: everything the courier entered, pay, history, vehicle check photos, and the
// decision.
// Shown in the Approvals and Team stacks; each has its own reject sheet so Back stays in that stack.
export function ReviewDetailScreen({ rejectPath }: { rejectPath: "/approvals/reject" | "/team/shift/reject" }) {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { resource, reload, approve, correct } = useApprovalDetail(id);
  const data = resource.status === "ready" ? resource.data : null;
  const format = useFormat(data?.firm.timeZone ?? "UTC", data?.firm.currency ?? "EUR");
  const [busy, setBusy] = useState<"approve" | "save" | null>(null);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  // The correction being typed, and what it started from (only changed fields are sent).
  const [editing, setEditing] = useState<{ fields: EditFields; original: EditFields } | null>(null);

  if (resource.status === "loading") {
    return (
      <View className="flex-1 gap-4 bg-canvas p-4">
        <View className="h-72 rounded-lg bg-border" />
        <View className="h-24 rounded-lg bg-border" />
      </View>
    );
  }
  if (resource.status === "failed") {
    return (
      <View className="flex-1 gap-3 bg-canvas p-4">
        <Alert
          tone={resource.failure === "offline" ? "offline" : "danger"}
          message={t(resource.failure === "notFound" ? "review.notFound" : failureMessage(resource.failure))}
        />
        <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
      </View>
    );
  }

  const { shift, courierName, pay, changes, stations, buses, photos, firm } = resource.data;
  const errors = editing ? editErrors(editing.fields) : {};

  const onApprove = async () => {
    setBusy("approve");
    setMessage(null);
    const failure = await approve();
    setBusy(null);
    if (failure) setMessage(failureMessage(failure));
    else router.back();
  };

  const onSave = async () => {
    if (!editing || Object.keys(errors).length > 0) return;
    const body = correctionOf(editing.fields, editing.original);
    if (Object.keys(body).length === 0) return setEditing(null);
    setBusy("save");
    setMessage(null);
    const failure = await correct(body);
    setBusy(null);
    if (failure) setMessage(failureMessage(failure));
    else setEditing(null);
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
      <Stack.Screen options={{ title: courierName }} />

      {editing ? (
        <Surface className="gap-4 p-5">
          <ThemedText variant="title" accessibilityRole="header">
            {t("review.correctTitle")}
          </ThemedText>
          <ShiftEditForm
            fields={editing.fields}
            errors={errors}
            stations={stations}
            buses={buses}
            onChange={(change) => setEditing({ ...editing, fields: { ...editing.fields, ...change } })}
          />
        </Surface>
      ) : (
        <>
          <ShiftCard shift={shift} format={format} />
          <RejectionAlert rejection={shift.rejection} />
          <PayCard shift={shift} pay={pay} format={format} />
          {changes.length > 0 ? <ChangesCard changes={changes} format={format} /> : null}
          <VehicleCheckCard plate={shift.car.plate} photos={photos} />
        </>
      )}

      {message ? <Alert tone={message === "review.actionOffline" ? "offline" : "danger"} message={t(message)} /> : null}

      {editing ? (
        <View className="gap-3">
          <Button
            title={t("review.saveCorrection")}
            loading={busy === "save"}
            disabled={Object.keys(errors).length > 0}
            onPress={() => void onSave()}
          />
          <Button title={t("shifts.time.cancel")} variant="secondary" onPress={() => setEditing(null)} />
        </View>
      ) : shift.status === "submitted" ? (
        <View className="gap-3">
          <Button title={t("review.approve")} loading={busy === "approve"} onPress={() => void onApprove()} />
          <Button
            title={t("review.reject")}
            variant="secondary"
            disabled={busy !== null}
            onPress={() => router.push({ pathname: rejectPath, params: { id } })}
          />
          <Button
            title={t("review.correct")}
            variant="secondary"
            disabled={busy !== null}
            onPress={() => {
              const fields = editFieldsOf(shift, firm.timeZone);
              setEditing({ fields, original: fields });
            }}
          />
        </View>
      ) : shift.status === "approved" ? (
        <Button
          title={t("review.correct")}
          variant="secondary"
          onPress={() => {
            const fields = editFieldsOf(shift, firm.timeZone);
            setEditing({ fields, original: fields });
          }}
        />
      ) : (
        <ThemedText variant="footnote">{t("review.waitingForCourier")}</ThemedText>
      )}
    </ScrollView>
  );
}
