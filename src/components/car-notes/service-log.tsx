import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { ActionSheet } from "@/components/action-sheet";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { DocumentsFailure } from "@/components/documents/load-state";
import { Icon } from "@/components/icon";
import { Notice } from "@/components/notice";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useCarNotes } from "@/car-notes/car-notes";
import { carNoteTypes } from "@/domain/car-notes";
import type { CarNoteType } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

import { addNote, NoteList, NotesSection, type NoteStack } from "./note-row";

// The firm's service log, newest first: filter by car (a choice sheet, archived cars included) and by type
// (chips), 50 notes at a time with "Show more". With a car picked, a note can be added to it here too.
export function ServiceLog({ stack, initialCarId }: { stack: NoteStack; initialCarId?: string }) {
  const { t } = useTranslation();
  const spinner = useThemeColor("secondary-ink");
  const [carId, setCarId] = useState<string | null>(initialCarId ?? null);
  const [type, setType] = useState<CarNoteType | null>(null);
  const [choosingCar, setChoosingCar] = useState(false);
  const { log, refreshing, reload, more } = useCarNotes({ carId, type });
  const page = log.status === "ready" ? log.page : null;
  const car = page?.cars.find((c) => c.id === carId);

  return (
    <>
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 px-4 pt-4 pb-8"
        refreshControl={
          page ? <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} /> : undefined
        }
      >
        <Surface className="overflow-hidden">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("carNotes.filter.car")}, ${car?.plate ?? t("carNotes.filter.allCars")}`}
            disabled={!page}
            onPress={() => setChoosingCar(true)}
            className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
          >
            <Icon name="car" color="ink-muted" />
            <ThemedText variant="body" color="ink" className="flex-1" style={{ fontVariant: ["tabular-nums"] }}>
              {car?.plate ?? t("carNotes.filter.allCars")}
            </ThemedText>
            <Icon name="filter" size="sm" color="ink-muted" />
          </Pressable>
        </Surface>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
          <Chip label={t("carNotes.filter.allTypes")} selected={type === null} onPress={() => setType(null)} />
          {carNoteTypes.map((option) => (
            <Chip key={option} label={t(`carNotes.types.${option}`)} selected={type === option} onPress={() => setType(option)} />
          ))}
        </ScrollView>

        {log.status === "loading" ? (
          <View className="h-60 rounded-lg bg-border" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        ) : log.status === "failed" ? (
          <DocumentsFailure failure={log.failure} onRetry={() => reload()} />
        ) : log.page.notes.length === 0 ? (
          <Notice
            icon="wrench"
            title={t("carNotes.emptyTitle")}
            body={carId || type ? t("carNotes.emptyFiltered") : t("carNotes.emptyBody")}
          />
        ) : (
          <>
            <NoteList notes={log.page.notes} stack={stack} showPlate={!carId} />
            {log.moreFailed ? <Alert tone="danger" message={t("carNotes.moreError")} /> : null}
            {log.page.next ? (
              <Button title={t("carNotes.more")} variant="secondary" loading={log.loadingMore} onPress={() => void more()} />
            ) : null}
          </>
        )}
        {carId && page ? <Button title={t("carNotes.add")} variant="secondary" onPress={() => addNote(stack, carId, page.today)} /> : null}
      </ScrollView>
      <ActionSheet
        visible={choosingCar}
        title={t("carNotes.filter.car")}
        actions={[
          { label: t("carNotes.filter.allCars"), onPress: () => setCarId(null) },
          ...(page?.cars ?? []).map((c) => ({ label: c.plate, onPress: () => setCarId(c.id) })),
        ]}
        cancelLabel={t("fleet.cancel")}
        onClose={() => setChoosingCar(false)}
      />
    </>
  );
}

/** A car's latest five notes on the owner's car screen, with See all (the log, filtered by it) and Add note. */
export function CarServiceNotes({ carId, today }: { carId: string; today: string }) {
  const { log } = useCarNotes({ carId, type: null });
  if (log.status !== "ready") return null;
  return (
    <NotesSection
      notes={log.page.notes.slice(0, 5)}
      stack="profile"
      carId={carId}
      today={today}
      onSeeAll={() => router.push({ pathname: "/profile/service-log", params: { carId } })}
    />
  );
}
