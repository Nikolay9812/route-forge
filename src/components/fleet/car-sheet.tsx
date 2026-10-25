import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { MAX_PLATE, normalizePlate, validPlate } from "@/domain/fleet";
import { useFleetActions } from "@/fleet/fleet";
import { useTranslation } from "@/i18n";

import { FleetSheet, useConfirmArchive, useSheetSave } from "./sheet";

// Add a car to a depot (`depotId`), change its plate or depot, archive it, or restore an archived one.
export function CarSheet() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string; depotId?: string }>();
  const actions = useFleetActions();
  const car = actions.car(params.id);
  const depots = actions.fleet?.depots.filter((d) => !d.archived) ?? [];
  const [plate, setPlate] = useState(car?.plate ?? "");
  const [depotId, setDepotId] = useState(car?.depotId ?? params.depotId);
  const { saving, failure, run, clear } = useSheetSave();
  const confirm = useConfirmArchive();

  const missing = params.id !== undefined && actions.fleet !== null && !car;
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  const valid = validPlate(plate);
  const typed = plate.trim() !== "";
  const changed = valid !== null && depotId !== undefined && (valid !== car?.plate || depotId !== car?.depotId);
  const plateError =
    failure === "taken" ? t("fleet.car.taken") : typed && !valid ? t("fleet.car.plateInvalid") : undefined;
  const hint = valid && valid !== plate ? t("fleet.car.plateHint", { plate: normalizePlate(plate) }) : null;

  const failureAlert =
    failure === "offline" ? (
      <Alert tone="offline" message={t("fleet.saveOffline")} />
    ) : failure && failure !== "taken" ? (
      <Alert tone="danger" message={t("fleet.saveError")} />
    ) : null;

  if (car?.archived) {
    const depot = actions.depot(car.depotId);
    return (
      <FleetSheet title={t("fleet.car.archivedTitle")} body={t("fleet.car.archivedBody")}>
        <TextField
          label={t("fleet.car.plate")}
          accessibilityLabel={t("fleet.car.plate")}
          value={car.plate}
          editable={false}
        />
        {depot?.archived ? (
          <Alert tone="danger" message={t("fleet.car.depotArchived", { depot: depot.name })} />
        ) : (
          failureAlert
        )}
        <View className="gap-3">
          <Button
            title={t("fleet.car.restore")}
            disabled={depot?.archived}
            loading={saving}
            onPress={() => void run(() => actions.archiveCar(car.id, false))}
          />
          <Button title={t("fleet.cancel")} variant="secondary" disabled={saving} onPress={() => router.back()} />
        </View>
      </FleetSheet>
    );
  }

  const save = () => {
    if (!valid || !depotId) return;
    void run(() =>
      car
        ? actions.updateCar(car.id, {
            ...(valid !== car.plate ? { plate: valid } : {}),
            ...(depotId !== car.depotId ? { depotId } : {}),
          })
        : actions.addCar(valid, depotId),
    );
  };

  return (
    <FleetSheet title={t(car ? "fleet.car.editTitle" : "fleet.car.newTitle")}>
      <View className="gap-1">
        <TextField
          label={t("fleet.car.plate")}
          accessibilityLabel={t("fleet.car.plate")}
          value={plate}
          onChangeText={(text) => {
            setPlate(text);
            if (failure === "taken") clear();
          }}
          placeholder={t("fleet.car.platePlaceholder")}
          maxLength={MAX_PLATE + 10}
          autoFocus={!car}
          autoCapitalize="characters"
          autoCorrect={false}
          error={plateError}
        />
        {hint && !plateError ? (
          <ThemedText variant="footnote" className="ml-1">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <View className="gap-2">
        <ThemedText variant="caption">{t("fleet.car.depot")}</ThemedText>
        <View className="flex-row flex-wrap gap-2">
          {depots.map((d) => (
            <Chip key={d.id} label={d.name} selected={d.id === depotId} onPress={() => setDepotId(d.id)} />
          ))}
        </View>
      </View>
      {failureAlert}
      <View className="gap-3">
        <Button title={t("fleet.save")} disabled={!changed} loading={saving} onPress={save} />
        {car ? (
          <Button
            title={t("fleet.car.archive")}
            variant="destructive"
            disabled={saving}
            onPress={() =>
              confirm(t("fleet.car.confirmTitle"), t("fleet.confirmBody"), () =>
                void run(() => actions.archiveCar(car.id, true)),
              )
            }
          />
        ) : (
          <Button title={t("fleet.cancel")} variant="secondary" disabled={saving} onPress={() => router.back()} />
        )}
      </View>
    </FleetSheet>
  );
}
