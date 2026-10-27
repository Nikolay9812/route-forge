import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { useResource } from "@/api/use-resource";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { DateField } from "@/components/date-field";
import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { FleetSheet } from "@/components/fleet/sheet";
import { useFormat } from "@/components/home/format";
import { NumberField } from "@/components/shifts/number-field";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { carNoteTypes, earliestNoteDay, MAX_NOTE_KM, MAX_NOTE_TEXT } from "@/domain/car-notes";
import type { CarNote, CarNoteInput, CarNoteType } from "@/domain/types";
import { useSaveNote } from "@/car-notes/car-notes";
import { useTranslation } from "@/i18n";

import { noteRoutes, type NoteStack } from "./note-row";

type Values = { type: CarNoteType | null; doneOn: string; km: string; text: string };

/**
 * The note form sheet of a stack: `?carId=&today=` adds a note to that car and then opens it (to add photos);
 * `?id=` loads a note and saves it whole, then closes.
 */
export function NoteFormSheet({ stack }: { stack: NoteStack }) {
  const { id, carId, today } = useLocalSearchParams<{ id?: string; carId?: string; today?: string }>();
  const { resource, reload } = useResource<CarNote>(id ? `/api/car-notes/${id}` : null);

  if (!id) {
    if (!carId || !today) return null;
    return <NoteForm stack={stack} target={{ carId }} today={today} />;
  }
  if (resource.status === "ready") return <NoteForm stack={stack} target={{ id }} note={resource.data} />;
  return (
    <FleetSheet title="">
      {resource.status === "loading" ? <DocumentsSkeleton rows={1} /> : <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />}
    </FleetSheet>
  );
}

// Type chips, the day the work was done, the km then, and what was done (required for "Other"). A failed save
// keeps everything typed.
function NoteForm({
  stack,
  target,
  note,
  today,
}: {
  stack: NoteStack;
  target: { id: string } | { carId: string };
  note?: CarNote;
  today?: string;
}) {
  const { t } = useTranslation();
  const format = useFormat("UTC", "EUR");
  const save = useSaveNote();
  const [values, setValues] = useState<Values>(() => ({
    type: note?.type ?? null,
    doneOn: note?.doneOn ?? today ?? "",
    km: note?.km === null || note?.km === undefined ? "" : String(note.km),
    text: note?.text ?? "",
  }));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const set = (change: Partial<Values>) => {
    setValues((previous) => ({ ...previous, ...change }));
    setFailure(null);
  };

  const km = values.km === "" ? null : Number(values.km);
  const text = values.text.trim();
  const errors = {
    type: values.type === null ? t("carNotes.form.typeMissing") : undefined,
    doneOn:
      today && values.doneOn > today
        ? t("carNotes.form.future")
        : today && values.doneOn < earliestNoteDay(today)
          ? t("carNotes.form.tooOld")
          : undefined,
    km: km !== null && km > MAX_NOTE_KM ? t("fleet.papers.kmInvalid") : undefined,
    text:
      values.type === "other" && text === ""
        ? t("carNotes.form.textMissing")
        : text.length > MAX_NOTE_TEXT
          ? t("carNotes.form.textTooLong", { max: MAX_NOTE_TEXT })
          : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = async () => {
    setTried(true);
    if (!valid || values.type === null) return;
    const input: CarNoteInput = { type: values.type, doneOn: values.doneOn, km, text: text === "" ? null : text };
    setSaving(true);
    const result = await save(target, input);
    setSaving(false);
    if (typeof result === "string") return setFailure(result);
    // A new note opens right away, so its photos can be added.
    if ("carId" in target) router.replace({ pathname: noteRoutes[stack].note, params: { id: result.id } });
    else router.back();
  };

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" className="bg-surface">
      <FleetSheet title={note ? t("carNotes.form.editTitle") : t("carNotes.form.addTitle")}>
        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={t("carNotes.form.type")}>
          <ThemedText variant="label">{t("carNotes.form.type")}</ThemedText>
          <View className="flex-row flex-wrap gap-2">
            {carNoteTypes.map((type) => (
              <Chip
                key={type}
                label={t(`carNotes.types.${type}`)}
                tone="primary"
                selected={values.type === type}
                onPress={() => set({ type })}
              />
            ))}
          </View>
          {tried && errors.type ? (
            <ThemedText variant="footnote" weight="regular" color="danger" className="ml-1">
              {errors.type}
            </ThemedText>
          ) : null}
        </View>
        <View className="gap-1.5">
          <DateField
            label={t("carNotes.form.doneOn")}
            value={values.doneOn}
            display={values.doneOn ? format.fullDay(values.doneOn) : ""}
            onChange={(doneOn) => set({ doneOn })}
          />
          {errors.doneOn ? (
            <ThemedText variant="footnote" weight="regular" color="danger" className="ml-1">
              {errors.doneOn}
            </ThemedText>
          ) : null}
        </View>
        <NumberField label={t("carNotes.form.km")} icon="km" value={values.km} onChange={(next) => set({ km: next })} error={errors.km} />
        <TextField
          label={t("carNotes.form.text")}
          accessibilityLabel={t("carNotes.form.text")}
          placeholder={t("carNotes.form.textPlaceholder")}
          value={values.text}
          onChangeText={(next) => set({ text: next })}
          multiline
          textAlignVertical="top"
          maxLength={MAX_NOTE_TEXT + 50}
          error={tried ? errors.text : undefined}
        />
        {failure === "offline" ? (
          <Alert tone="offline" message={t("fleet.saveOffline")} />
        ) : failure === "notEditable" ? (
          <Alert tone="danger" message={t("carNotes.locked")} />
        ) : failure ? (
          <Alert tone="danger" message={t("fleet.saveError")} />
        ) : null}
        <Button title={t("fleet.save")} loading={saving} onPress={() => void submit()} />
      </FleetSheet>
    </ScrollView>
  );
}
