import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { CarServiceNotes } from "@/components/car-notes/service-log";
import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { ExpiryLine } from "@/components/documents/expiry-line";
import { OptionalDateField } from "@/components/documents/optional-date-field";
import { useFormat } from "@/components/home/format";
import { PhotoSlot } from "@/components/photo-slot";
import { Surface } from "@/components/surface";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { carWarnings, lastDayOfMonth, MAX_SERVICE_KM, normalizeVin, validVin } from "@/domain/fleet";
import { TALON_RATIO } from "@/domain/photos";
import type { CarDetail, CarPapers } from "@/domain/types";
import { useCar, useFleetActions } from "@/fleet/fleet";
import { useTranslation } from "@/i18n";

import { FleetRow } from "./fleet-rows";
import { MonthField } from "./month-field";
import { useSheetSave } from "./sheet";

const openSheet = (id: string) => router.push({ pathname: "/profile/car", params: { id } });

// One of the owner's cars: its plate and depot (edited in the car sheet), any warnings, the talon photo (saved as
// soon as it's added), the papers, saved as a whole, and the car's latest service log notes. Comes back up to date
// after the sheet closes.
export function CarScreen({ id }: { id: string | undefined }) {
  const { t } = useTranslation();
  const car = useCar(id);
  const { resource, reload } = car;

  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );

  const missing = !id || (resource.status === "failed" && resource.failure === "notFound");
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  if (resource.status === "ready") return <PapersForm key={resource.data.papersUpdatedAt} car={resource.data} actions={car} />;
  return (
    <>
      <Stack.Screen options={{ title: t("fleet.papers.title") }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 px-4 pt-4 pb-8"
      >
        {resource.status === "loading" ? (
          <DocumentsSkeleton />
        ) : (
          <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />
        )}
      </ScrollView>
    </>
  );
}

type Values = { vin: string; tuvDue: string | null; insuranceExpiresOn: string | null; serviceDueOn: string | null; serviceDueKm: string };

function valuesOf(papers: CarPapers): Values {
  return {
    vin: papers.vin ?? "",
    tuvDue: papers.tuvDue,
    insuranceExpiresOn: papers.insuranceExpiresOn,
    serviceDueOn: papers.serviceDueOn,
    serviceDueKm: papers.serviceDueKm === null ? "" : String(papers.serviceDueKm),
  };
}

/** The typed service km: null when empty, "invalid" unless whole km (group separators allowed). */
function kmOf(text: string): number | null | "invalid" {
  const digits = text.replace(/[\s.,]/g, "");
  if (digits === "") return null;
  const km = Number(digits);
  return /^\d+$/.test(digits) && km <= MAX_SERVICE_KM ? km : "invalid";
}

/** The papers to save, or null while the VIN or km isn't valid. */
function papersOf(values: Values): CarPapers | null {
  const vin = values.vin.trim() === "" ? null : validVin(values.vin);
  const km = kmOf(values.serviceDueKm);
  if ((vin === null && values.vin.trim() !== "") || km === "invalid") return null;
  return { vin, tuvDue: values.tuvDue, insuranceExpiresOn: values.insuranceExpiresOn, serviceDueOn: values.serviceDueOn, serviceDueKm: km };
}

function PapersForm({ car, actions }: { car: CarDetail; actions: ReturnType<typeof useCar> }) {
  const { t } = useTranslation();
  // Calendar days formatted at UTC noon land on the same day everywhere.
  const format = useFormat("UTC", "EUR");
  const depot = useFleetActions().depot(car.depotId);
  const [initial] = useState(() => valuesOf(car.papers));
  const [values, setValues] = useState(initial);
  const [tried, setTried] = useState(false);
  const { saving, failure, run, clear } = useSheetSave();
  const { today } = car;

  const papers = papersOf(values);
  const changed = JSON.stringify(values) !== JSON.stringify(initial);
  const warnings = carWarnings(car, today);
  // No photos on web: uploading there would need a bucket CORS rule.
  const photos = Platform.OS !== "web";

  const set = (change: Partial<Values>) => {
    setValues((previous) => ({ ...previous, ...change }));
    clear();
  };

  const submit = () => {
    setTried(true);
    if (!papers) return;
    void run(() => actions.savePapers(papers));
  };

  const vinTyped = values.vin.trim() !== "";
  const vin = vinTyped ? validVin(values.vin) : null;
  const vinError =
    failure === "taken"
      ? t("fleet.papers.vinTaken")
      : vinTyped && !vin && (tried || normalizeVin(values.vin).length >= 17)
        ? t("fleet.papers.vinInvalid")
        : undefined;
  const vinHint = vin && vin !== values.vin ? t("fleet.car.plateHint", { plate: vin }) : null;
  const km = kmOf(values.serviceDueKm);
  const kmInvalid = km === "invalid";
  const dueKm = km === "invalid" ? null : km;
  const odometer = car.odometerKm;

  return (
    <>
      <Stack.Screen options={{ title: car.plate }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-4 px-4 pt-4 pb-8"
      >
        <Surface className="overflow-hidden">
          <FleetRow
            icon="car"
            title={car.plate}
            detail={[depot?.name, car.archived ? t("fleet.archivedTag") : null].filter(Boolean).join(" · ")}
            onPress={() => openSheet(car.id)}
          />
        </Surface>
        {warnings.map((w) => (
          <Alert key={w.kind} tone="danger" message={t(`fleet.papers.warnings.${w.kind}.${w.level}`)} />
        ))}
        {photos ? (
          <View className="gap-2">
            <ThemedText variant="footnote" className="ml-1">
              {t("fleet.papers.talon")}
            </ThemedText>
            <View className="flex-row">
              <PhotoSlot
                label={t("fleet.papers.talon")}
                emptyText={t("fleet.papers.talonAdd")}
                aspectRatio={TALON_RATIO}
                photo={car.photos.talon}
                uploadingUri={actions.uploading.talon}
                onAdd={(photo) => actions.addPhoto("talon", photo)}
                onRemove={() => actions.removePhoto("talon")}
              />
            </View>
            <ThemedText variant="footnote" className="ml-1">
              {t("documents.photos.saved")}
            </ThemedText>
          </View>
        ) : null}
        <Surface className="gap-4 p-5">
          <View className="gap-1">
            <TextField
              label={t("fleet.papers.vin")}
              accessibilityLabel={t("fleet.papers.vin")}
              value={values.vin}
              onChangeText={(text) => set({ vin: text })}
              placeholder="ZFA250006SMC06228"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={24}
              error={vinError}
            />
            <ThemedText variant="footnote" className="ml-1">
              {vinHint && !vinError ? vinHint : t("fleet.papers.vinHint")}
            </ThemedText>
          </View>
          <View className="gap-1">
            <MonthField
              label={t("fleet.papers.tuv")}
              value={values.tuvDue}
              display={values.tuvDue ? format.monthYear(`${values.tuvDue}-01`) : ""}
              initial={today.slice(0, 7)}
              onChange={(tuvDue) => set({ tuvDue })}
            />
            {values.tuvDue ? <ExpiryLine today={today} expiresOn={lastDayOfMonth(values.tuvDue)} className="ml-1" /> : null}
          </View>
          <View className="gap-1">
            <OptionalDateField
              label={t("fleet.papers.insurance")}
              value={values.insuranceExpiresOn}
              display={values.insuranceExpiresOn ? format.fullDay(values.insuranceExpiresOn) : ""}
              initial={today}
              onChange={(insuranceExpiresOn) => set({ insuranceExpiresOn })}
            />
            {values.insuranceExpiresOn ? <ExpiryLine today={today} expiresOn={values.insuranceExpiresOn} className="ml-1" /> : null}
          </View>
          <OptionalDateField
            label={t("fleet.papers.serviceDate")}
            value={values.serviceDueOn}
            display={values.serviceDueOn ? format.fullDay(values.serviceDueOn) : ""}
            initial={today}
            onChange={(serviceDueOn) => set({ serviceDueOn })}
          />
          <View className="gap-1">
            <TextField
              label={t("fleet.papers.serviceKm")}
              accessibilityLabel={t("fleet.papers.serviceKm")}
              value={values.serviceDueKm}
              onChangeText={(text) => set({ serviceDueKm: text })}
              keyboardType="number-pad"
              maxLength={10}
              error={kmInvalid ? t("fleet.papers.kmInvalid") : undefined}
            />
            {odometer !== null && !kmInvalid ? (
              <ThemedText variant="footnote" color={dueKm !== null && odometer >= dueKm ? "danger" : "ink-muted"} className="ml-1">
                {dueKm === null
                  ? t("fleet.papers.odometer", { km: format.count(odometer) })
                  : odometer >= dueKm
                    ? t("fleet.papers.kmOver", { km: format.count(odometer), over: format.count(odometer - dueKm) })
                    : t("fleet.papers.kmLeft", { km: format.count(odometer), left: format.count(dueKm - odometer) })}
              </ThemedText>
            ) : null}
          </View>
        </Surface>
        {failure === "offline" ? (
          <Alert tone="offline" message={t("fleet.saveOffline")} />
        ) : failure && failure !== "taken" ? (
          <Alert tone="danger" message={t("fleet.saveError")} />
        ) : null}
        <Button title={t("fleet.save")} disabled={!changed} loading={saving} onPress={submit} />
        <CarServiceNotes carId={car.id} today={today} />
      </ScrollView>
    </>
  );
}
