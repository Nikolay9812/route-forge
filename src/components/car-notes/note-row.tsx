import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { useFormat } from "@/components/home/format";
import { Icon } from "@/components/icon";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import type { CarNote } from "@/domain/types";
import { useTranslation } from "@/i18n";

/** Where a stack keeps its note screen and note form sheet. */
export const noteRoutes = {
  cars: { note: "/cars/note", form: "/cars/note-form" },
  profile: { note: "/profile/car-note", form: "/profile/note-form" },
} as const;
export type NoteStack = keyof typeof noteRoutes;

export const openNote = (stack: NoteStack, id: string) => router.push({ pathname: noteRoutes[stack].note, params: { id } });
export const addNote = (stack: NoteStack, carId: string, today: string) =>
  router.push({ pathname: noteRoutes[stack].form, params: { carId, today } });

// One service log entry: the work and its day, the text (two lines), then km, author and photos. A full-width row
// that highlights on press.
export function NoteRow({ note, showPlate = false, onPress }: { note: CarNote; showPlate?: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  // Calendar days formatted at UTC noon land on the same day everywhere.
  const format = useFormat("UTC", "EUR");
  const type = t(`carNotes.types.${note.type}`);
  const details = [
    note.km !== null ? t("carNotes.km", { km: format.count(note.km) }) : null,
    note.byName,
    note.photoCount > 0 ? t("carNotes.photoCount", { count: note.photoCount }) : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
    >
      <Icon name="wrench" color="ink-muted" />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-baseline gap-2">
          <ThemedText variant="label" numberOfLines={1} className="flex-1">
            {showPlate ? `${type} · ${note.plate}` : type}
          </ThemedText>
          <ThemedText variant="footnote">{format.fullDay(note.doneOn)}</ThemedText>
        </View>
        {note.text ? (
          <ThemedText variant="body" numberOfLines={2}>
            {note.text}
          </ThemedText>
        ) : null}
        <ThemedText variant="footnote" numberOfLines={1}>
          {details.join(" · ")}
        </ThemedText>
      </View>
      <Icon name="chevron" size="sm" color="ink-muted" />
    </Pressable>
  );
}

/** Notes as one card of rows, newest first. */
export function NoteList({ notes, stack, showPlate = false }: { notes: CarNote[]; stack: NoteStack; showPlate?: boolean }) {
  return (
    <Surface className="overflow-hidden">
      {notes.map((note, i) => (
        <Fragment key={note.id}>
          {i > 0 ? <Divider className="mx-4" /> : null}
          <NoteRow note={note} showPlate={showPlate} onPress={() => openNote(stack, note.id)} />
        </Fragment>
      ))}
    </Surface>
  );
}

// A car's latest notes under a "Service log" heading, with Add note (unless the screen has its own) and, when
// given, See all. Empty says so.
export function NotesSection({
  notes,
  stack,
  carId,
  today,
  onSeeAll,
  showAdd = true,
}: {
  notes: CarNote[];
  stack: NoteStack;
  carId: string;
  today: string;
  onSeeAll?: () => void;
  showAdd?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <View className="ml-1 flex-row items-center justify-between">
        <ThemedText variant="footnote">{t("carNotes.title")}</ThemedText>
        {onSeeAll && notes.length > 0 ? (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onSeeAll}>
            <ThemedText variant="footnote" color="secondary-ink">
              {t("carNotes.seeAll")}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {notes.length > 0 ? (
        <NoteList notes={notes} stack={stack} />
      ) : (
        <Surface className="p-5">
          <ThemedText variant="body">{t("carNotes.empty")}</ThemedText>
        </Surface>
      )}
      {showAdd ? <Button title={t("carNotes.add")} variant="secondary" onPress={() => addNote(stack, carId, today)} /> : null}
    </View>
  );
}
