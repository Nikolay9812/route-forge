import { router } from "expo-router";
import { Fragment } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { FleetRow } from "@/components/fleet/fleet-rows";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Notice } from "@/components/notice";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { FleetDepot } from "@/domain/types";
import { useFleet } from "@/fleet/fleet";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

const openDepot = (id?: string) => router.push({ pathname: "/profile/depot", params: id ? { id } : {} });
const openCar = (params: { id: string } | { depotId: string }) => router.push({ pathname: "/profile/car", params });

// The owner's depots, each with its active cars, then everything archived. Edits happen in form sheets.
export default function FleetScreen() {
  const { t } = useTranslation();
  const spinner = useThemeColor("secondary-ink");
  const { resource, refreshing, reload } = useFleet();
  const data = resource.status === "ready" ? resource.data : null;
  const active = data?.depots.filter((d) => !d.archived) ?? [];
  const archivedDepots = data?.depots.filter((d) => d.archived) ?? [];
  const archivedCars = data?.depots.flatMap((d) => d.cars.filter((c) => c.archived).map((c) => ({ car: c, depot: d })));

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pt-4 pb-8"
      refreshControl={
        data ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} />
        ) : undefined
      }
    >
      {resource.status === "loading" ? (
        <View className="gap-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View className="h-button rounded-full bg-border" />
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
              message={resource.failure === "offline" ? t("fleet.offline") : t("fleet.error")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
          </View>
        )
      ) : (
        <>
          <SectionEntrance index={0}>
            <Button title={t("fleet.addDepot")} variant="secondary" onPress={() => openDepot()} />
          </SectionEntrance>
          {active.length === 0 ? (
            <SectionEntrance index={1}>
              <Notice icon="depot" title={t("fleet.emptyTitle")} body={t("fleet.emptyBody")} />
            </SectionEntrance>
          ) : (
            active.map((depot, i) => (
              <SectionEntrance key={depot.id} index={i + 1}>
                <DepotCard depot={depot} />
              </SectionEntrance>
            ))
          )}
          {archivedDepots.length > 0 || (archivedCars?.length ?? 0) > 0 ? (
            <SectionEntrance index={active.length + 1}>
              <View className="gap-2 pt-2">
                <ThemedText variant="footnote" className="ml-1">
                  {t("fleet.archived")}
                </ThemedText>
                <Surface className="overflow-hidden">
                  {archivedDepots.map((depot, i) => (
                    <Fragment key={depot.id}>
                      {i > 0 ? <Divider className="mx-4" /> : null}
                      <FleetRow
                        icon="depot"
                        title={depot.name}
                        tone="ink-muted"
                        trailing={<Tag tone="role" size="sm" label={t("fleet.archivedTag")} />}
                        onPress={() => openDepot(depot.id)}
                      />
                    </Fragment>
                  ))}
                  {archivedCars?.map(({ car, depot }, i) => (
                    <Fragment key={car.id}>
                      {archivedDepots.length + i > 0 ? <Divider className="mx-4" /> : null}
                      <FleetRow
                        icon="car"
                        title={car.plate}
                        detail={depot.name}
                        tone="ink-muted"
                        trailing={<Tag tone="role" size="sm" label={t("fleet.archivedTag")} />}
                        onPress={() => openCar({ id: car.id })}
                      />
                    </Fragment>
                  ))}
                </Surface>
              </View>
            </SectionEntrance>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function DepotCard({ depot }: { depot: FleetDepot }) {
  const { t } = useTranslation();
  const cars = depot.cars.filter((c) => !c.archived);
  return (
    <Surface className="overflow-hidden">
      <FleetRow
        icon="depot"
        title={depot.name}
        detail={t("fleet.carCount", { count: cars.length })}
        strong
        onPress={() => openDepot(depot.id)}
      />
      <Divider />
      {cars.map((car) => (
        <Fragment key={car.id}>
          <FleetRow icon="car" title={car.plate} onPress={() => openCar({ id: car.id })} />
          <Divider className="mx-4" />
        </Fragment>
      ))}
      <FleetRow
        icon="plus"
        title={t("fleet.addCar")}
        tone="secondary-ink"
        chevron={false}
        onPress={() => openCar({ depotId: depot.id })}
      />
    </Surface>
  );
}
