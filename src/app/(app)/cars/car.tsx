import { router, Stack, useLocalSearchParams } from "expo-router";
import { Fragment, useEffect, useState } from "react";
import { Platform, RefreshControl, ScrollView, View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { addNote, NotesSection } from "@/components/car-notes/note-row";
import { Divider } from "@/components/divider";
import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { FleetRow } from "@/components/fleet/fleet-rows";
import { useFormat } from "@/components/home/format";
import { PhotoSlot } from "@/components/photo-slot";
import { PhotoViewer } from "@/components/photo-viewer";
import { photoTag } from "@/components/shifts/vehicle-check-card";
import { VinRow } from "@/components/shifts/vin-row";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { TALON_RATIO } from "@/domain/photos";
import type { DocumentPhoto, GarageCarDetail } from "@/domain/types";
import { useGarageCar } from "@/garage/garage";
import { useTranslation } from "@/i18n";
import { useDisplayName } from "@/people/display-name";
import { useThemeColor } from "@/theme";

const openCheck = (shiftId: string) => router.push({ pathname: "/cars/check", params: { shiftId } });

// One car for the mechanic: Add note first, then what the papers warn about, the papers and talon (read-only),
// the vehicle checks of the last 7 days (who drove, how many photos), and the car's latest notes.
export default function Car() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { resource, refreshing, reload } = useGarageCar(id);
  const spinner = useThemeColor("secondary-ink");
  const data = resource.status === "ready" ? resource.data : null;

  // Archived or gone since the list loaded.
  const missing = !id || (resource.status === "failed" && resource.failure === "notFound");
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  return (
    <>
      <Stack.Screen options={{ title: data?.car.plate ?? "" }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 px-4 pt-4 pb-8"
        refreshControl={
          data ? <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} /> : undefined
        }
      >
        {resource.status === "loading" ? (
          <DocumentsSkeleton rows={3} />
        ) : resource.status === "failed" ? (
          <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />
        ) : (
          <CarDetail detail={resource.data} />
        )}
      </ScrollView>
    </>
  );
}

function CarDetail({ detail }: { detail: GarageCarDetail }) {
  const { t } = useTranslation();
  const displayName = useDisplayName();
  const format = useFormat("UTC", "EUR");
  const [viewing, setViewing] = useState<DocumentPhoto | null>(null);
  const { car, checks, notes, today } = detail;
  const { papers } = car;
  const notSet = t("garage.notSet");
  const rows = [
    { label: t("garage.depot"), value: car.depotName },
    { label: t("fleet.papers.tuv"), value: papers.tuvDue ? format.monthYear(`${papers.tuvDue}-01`) : notSet },
    { label: t("fleet.papers.insurance"), value: papers.insuranceExpiresOn ? format.fullDay(papers.insuranceExpiresOn) : notSet },
    { label: t("fleet.papers.serviceDate"), value: papers.serviceDueOn ? format.fullDay(papers.serviceDueOn) : notSet },
    {
      label: t("fleet.papers.serviceKm"),
      value: papers.serviceDueKm !== null ? t("carNotes.km", { km: format.count(papers.serviceDueKm) }) : notSet,
    },
    { label: t("garage.odometer"), value: car.odometerKm !== null ? t("carNotes.km", { km: format.count(car.odometerKm) }) : notSet },
  ];

  return (
    <>
      <Button title={t("carNotes.add")} onPress={() => addNote("cars", car.id, today)} />
      {car.warnings.map((w) => (
        <Alert key={w.kind} tone="danger" message={t(`fleet.papers.warnings.${w.kind}.${w.level}`)} />
      ))}

      <View className="gap-2">
        <ThemedText variant="footnote" className="ml-1">
          {t("garage.papers")}
        </ThemedText>
        <Surface className="gap-3 p-5">
          {papers.vin ? <VinRow vin={papers.vin} plate={car.plate} qrSheet="/cars/vin" /> : null}
          {rows.map((row) => (
            <View key={row.label} className="flex-row items-baseline justify-between gap-3">
              <ThemedText variant="body" className="flex-1">
                {row.label}
              </ThemedText>
              <ThemedText variant="label" style={{ fontVariant: ["tabular-nums"] }}>
                {row.value}
              </ThemedText>
            </View>
          ))}
        </Surface>
      </View>

      {car.photos.talon && Platform.OS !== "web" ? (
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("fleet.papers.talon")}
          </ThemedText>
          <View className="flex-row">
            <PhotoSlot label={t("fleet.papers.talon")} aspectRatio={TALON_RATIO} photo={car.photos.talon} onView={setViewing} />
          </View>
        </View>
      ) : null}

      <View className="gap-2">
        <ThemedText variant="footnote" className="ml-1">
          {t("garage.checks")}
        </ThemedText>
        {checks.length === 0 ? (
          <Surface className="p-5">
            <ThemedText variant="body">{t("garage.noChecks")}</ThemedText>
          </Surface>
        ) : (
          <Surface className="overflow-hidden">
            {checks.map((check, i) => {
              const tag = photoTag(check.photoCount, t);
              return (
                <Fragment key={check.shiftId}>
                  {i > 0 ? <Divider className="mx-4" /> : null}
                  <FleetRow
                    icon="camera"
                    title={check.date === today ? t("garage.today") : format.shortDay(check.date)}
                    detail={displayName(check.courierName)}
                    trailing={<Tag tone={tag.tone} size="sm" label={tag.label} />}
                    onPress={() => openCheck(check.shiftId)}
                  />
                </Fragment>
              );
            })}
          </Surface>
        )}
      </View>

      <NotesSection
        notes={notes}
        stack="cars"
        carId={car.id}
        today={today}
        showAdd={false}
        onSeeAll={() => router.push({ pathname: "/cars/log", params: { carId: car.id } })}
      />
      <PhotoViewer photo={viewing} label={t("fleet.papers.talon")} onClose={() => setViewing(null)} />
    </>
  );
}
