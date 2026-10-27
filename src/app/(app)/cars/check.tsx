import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";

import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { useFormat } from "@/components/home/format";
import { VehicleCheckCard } from "@/components/shifts/vehicle-check-card";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useGarageCheck } from "@/garage/garage";
import { useTranslation } from "@/i18n";

// One vehicle check of the last 7 days: who drove the car that day and its photos, read-only (a photo opens full
// screen). Nothing else about the shift.
export default function Check() {
  const { t } = useTranslation();
  const format = useFormat("UTC", "EUR");
  const { shiftId } = useLocalSearchParams<{ shiftId?: string }>();
  const { resource, reload } = useGarageCheck(shiftId);
  const check = resource.status === "ready" ? resource.data : null;

  return (
    <>
      <Stack.Screen options={{ title: check ? format.shortDay(check.date) : t("shiftPhotos.title") }} />
      <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-4 px-4 pt-4 pb-8">
        {resource.status === "loading" ? (
          <DocumentsSkeleton />
        ) : resource.status === "failed" ? (
          <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />
        ) : (
          <>
            <Surface className="gap-0.5 p-5">
              <ThemedText variant="title">{resource.data.courierName}</ThemedText>
              <ThemedText variant="footnote">{t("garage.drove", { date: format.longDay(resource.data.date) })}</ThemedText>
            </Surface>
            <VehicleCheckCard plate={resource.data.plate} photos={resource.data.photos} />
          </>
        )}
      </ScrollView>
    </>
  );
}
