import { router } from "expo-router";
import { Fragment } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { FleetRow } from "@/components/fleet/fleet-rows";
import { useFormat } from "@/components/home/format";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Notice } from "@/components/notice";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { GarageCar } from "@/domain/types";
import { useGarage } from "@/garage/garage";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

const openCar = (id: string) => router.push({ pathname: "/cars/car", params: { id } });

// The mechanic's start: every active car of the firm by depot, with its km now, the last note's day, and a tag
// when its papers need a look. Tapping a car opens it.
export default function Cars() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const spinner = useThemeColor("secondary-ink");
  const { resource, refreshing, reload } = useGarage();
  const data = resource.status === "ready" ? resource.data : null;
  const depots = data?.depots.filter((d) => d.cars.length > 0) ?? [];

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="gap-4 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 32 }}
      refreshControl={
        data ? <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} /> : undefined
      }
    >
      <ThemedText variant="heading" accessibilityRole="header">
        {t("garage.title")}
      </ThemedText>
      {resource.status === "loading" ? (
        <View className="gap-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View className="h-40 rounded-lg bg-border" />
          <View className="h-40 rounded-lg bg-border" />
        </View>
      ) : resource.status === "failed" ? (
        resource.failure === "firmNotSetUp" ? (
          <Notice icon="settings" title={t("firm.notSetUp.title")} body={t("firm.notSetUp.body")} />
        ) : (
          <View className="gap-3">
            <Alert
              tone={resource.failure === "offline" ? "offline" : "danger"}
              message={resource.failure === "offline" ? t("fleet.offline") : t("garage.error")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
          </View>
        )
      ) : depots.length === 0 ? (
        <Notice icon="car" title={t("garage.emptyTitle")} body={t("garage.emptyBody")} />
      ) : (
        depots.map((depot, i) => (
          <SectionEntrance key={depot.id} index={i}>
            <View className="gap-2">
              <ThemedText variant="footnote" className="ml-1">
                {depot.name}
              </ThemedText>
              <Surface className="overflow-hidden">
                {depot.cars.map((car, j) => (
                  <Fragment key={car.id}>
                    {j > 0 ? <Divider className="mx-4" /> : null}
                    <CarRow car={car} />
                  </Fragment>
                ))}
              </Surface>
            </View>
          </SectionEntrance>
        ))
      )}
    </ScrollView>
  );
}

function CarRow({ car }: { car: GarageCar }) {
  const { t } = useTranslation();
  const format = useFormat("UTC", "EUR");
  const detail = [
    car.odometerKm !== null ? t("carNotes.km", { km: format.count(car.odometerKm) }) : null,
    car.lastNoteOn ? t("garage.lastNote", { date: format.fullDay(car.lastNoteOn) }) : t("garage.noNotes"),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <FleetRow
      icon="car"
      title={car.plate}
      detail={detail}
      trailing={car.warnings.length > 0 ? <Tag tone="warning" size="sm" label={t("garage.check")} /> : undefined}
      onPress={() => openCar(car.id)}
    />
  );
}
