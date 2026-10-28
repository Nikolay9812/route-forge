import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Alert as NativeAlert, Platform, ScrollView, View } from "react-native";

import { ActionSheet } from "@/components/action-sheet";
import { Button } from "@/components/button";
import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { useFormat } from "@/components/home/format";
import { PhotoSlot } from "@/components/photo-slot";
import { PhotoViewer } from "@/components/photo-viewer";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { useCarNote } from "@/car-notes/car-notes";
import { addDays, NOTE_EDIT_DAYS } from "@/domain/car-notes";
import { carNotePhotoSlots } from "@/domain/photos";
import type { CarNote, DocumentPhoto } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { useDisplayName } from "@/people/display-name";

import { noteRoutes, type NoteStack } from "./note-row";

/** Receipts and parts are photographed upright. */
const PHOTO_RATIO = 3 / 4;

// One service log note: the work, its day, car and km, the text, who wrote it, and up to three photos. Its author
// adds or removes photos and edits it for 7 days; the owner may also delete it. Without the right, it's read-only.
export function NoteScreen({ id, stack }: { id: string | undefined; stack: NoteStack }) {
  const { t } = useTranslation();
  const note = useCarNote(id);
  const { resource, reload } = note;

  const missing = !id || (resource.status === "failed" && resource.failure === "notFound");
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  if (resource.status === "ready") return <NoteDetail note={resource.data} actions={note} stack={stack} />;
  return (
    <>
      <Stack.Screen options={{ title: t("carNotes.title") }} />
      <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-4 px-4 pt-4 pb-8">
        {resource.status === "loading" ? <DocumentsSkeleton /> : <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />}
      </ScrollView>
    </>
  );
}

function NoteDetail({ note, actions, stack }: { note: CarNote; actions: ReturnType<typeof useCarNote>; stack: NoteStack }) {
  const { t } = useTranslation();
  const displayName = useDisplayName();
  const format = useFormat("UTC", "EUR");
  const [viewing, setViewing] = useState<DocumentPhoto | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // No photo uploads on web: they would need a bucket CORS rule.
  const editPhotos = note.canEdit && Platform.OS !== "web";
  const photos = note.photos ?? {};
  const slots = editPhotos ? carNotePhotoSlots : carNotePhotoSlots.filter((slot) => photos[slot]);
  const writtenOn = note.createdAt.slice(0, 10);

  const remove = async () => {
    setDeleting(true);
    const failure = await actions.remove();
    setDeleting(false);
    if (!failure) return router.back();
    NativeAlert.alert(t("carNotes.delete"), t(failure === "offline" ? "fleet.saveOffline" : failure === "notEditable" ? "carNotes.locked" : "fleet.saveError"));
  };

  return (
    <>
      <Stack.Screen options={{ title: t(`carNotes.types.${note.type}`) }} />
      <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-4 px-4 pt-4 pb-8">
        <Surface className="gap-3 p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <ThemedText variant="title">{format.fullDay(note.doneOn)}</ThemedText>
              <ThemedText variant="footnote" style={{ fontVariant: ["tabular-nums"] }}>
                {[note.plate, note.km !== null ? t("carNotes.km", { km: format.count(note.km) }) : null].filter(Boolean).join(" · ")}
              </ThemedText>
            </View>
            {note.edited ? <Tag tone="info" size="sm" label={t("carNotes.edited")} /> : null}
          </View>
          {note.text ? (
            <ThemedText variant="body" color="ink" selectable>
              {note.text}
            </ThemedText>
          ) : null}
          <ThemedText variant="footnote">
            {t("carNotes.by", { name: displayName(note.byName), date: format.fullDay(writtenOn) })}
          </ThemedText>
        </Surface>

        {slots.length > 0 ? (
          <View className="gap-2">
            <ThemedText variant="footnote" className="ml-1">
              {t("carNotes.photos")}
            </ThemedText>
            <View className="flex-row gap-3">
              {slots.map((slot) => (
                <View key={slot} className="flex-1">
                  <PhotoSlot
                    label={t("carNotes.photo")}
                    photo={photos[slot]}
                    aspectRatio={PHOTO_RATIO}
                    {...(editPhotos
                      ? {
                          emptyText: null,
                          uploadingUri: actions.uploading[slot],
                          onAdd: (photo) => actions.addPhoto(slot, photo),
                          onRemove: () => actions.removePhoto(slot),
                        }
                      : { onView: setViewing })}
                  />
                </View>
              ))}
              {Array.from({ length: carNotePhotoSlots.length - slots.length }, (_, i) => (
                <View key={i} className="flex-1" />
              ))}
            </View>
            {editPhotos ? (
              <ThemedText variant="footnote" className="ml-1">
                {t("documents.photos.saved")}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {note.canEdit ? (
          <>
            <ThemedText variant="footnote" className="ml-1">
              {t("carNotes.editUntil", { date: format.fullDay(addDays(writtenOn, NOTE_EDIT_DAYS)) })}
            </ThemedText>
            <Button
              title={t("carNotes.edit")}
              variant="secondary"
              onPress={() => router.push({ pathname: noteRoutes[stack].form, params: { id: note.id } })}
            />
          </>
        ) : null}
        {note.canDelete ? (
          <Button title={t("carNotes.delete")} variant="destructive" loading={deleting} onPress={() => setConfirming(true)} />
        ) : null}
      </ScrollView>
      <ActionSheet
        visible={confirming}
        title={t("carNotes.deleteConfirm")}
        actions={[{ label: t("carNotes.delete"), destructive: true, onPress: () => void remove() }]}
        cancelLabel={t("fleet.cancel")}
        onClose={() => setConfirming(false)}
      />
      <PhotoViewer photo={viewing} label={t("carNotes.photo")} onClose={() => setViewing(null)} />
    </>
  );
}
