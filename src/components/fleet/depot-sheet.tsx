import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
import { MAX_DEPOT_NAME, validDepotName } from "@/domain/fleet";
import { useFleetActions } from "@/fleet/fleet";
import { useTranslation } from "@/i18n";

import { FleetSheet, useConfirmArchive, useSheetSave } from "./sheet";

// Add a depot (no id), rename or archive an active one, or restore an archived one.
export function DepotSheet() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const actions = useFleetActions();
  const depot = actions.depot(id);
  const [name, setName] = useState(depot?.name ?? "");
  const { saving, failure, run, clear } = useSheetSave();
  const confirm = useConfirmArchive();

  // The row is gone (e.g. the list reloaded without it): nothing to edit.
  const missing = id !== undefined && actions.fleet !== null && !depot;
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  const valid = validDepotName(name);
  const changed = valid !== null && valid !== depot?.name;
  const activeCars = depot?.cars.filter((c) => !c.archived).length ?? 0;

  const failureAlert =
    failure === "offline" ? (
      <Alert tone="offline" message={t("fleet.saveOffline")} />
    ) : failure === "depotHasCars" ? (
      <Alert tone="danger" message={t("fleet.depot.hasCars")} />
    ) : failure && failure !== "taken" ? (
      <Alert tone="danger" message={t("fleet.saveError")} />
    ) : null;

  if (depot?.archived) {
    return (
      <FleetSheet title={t("fleet.depot.archivedTitle")} body={t("fleet.depot.archivedBody")}>
        <TextField
          label={t("fleet.depot.name")}
          accessibilityLabel={t("fleet.depot.name")}
          value={depot.name}
          editable={false}
        />
        {failureAlert}
        <View className="gap-3">
          <Button
            title={t("fleet.depot.restore")}
            loading={saving}
            onPress={() => void run(() => actions.archiveDepot(depot.id, false))}
          />
          <Button title={t("fleet.cancel")} variant="secondary" disabled={saving} onPress={() => router.back()} />
        </View>
      </FleetSheet>
    );
  }

  return (
    <FleetSheet title={t(depot ? "fleet.depot.editTitle" : "fleet.depot.newTitle")}>
      <TextField
        label={t("fleet.depot.name")}
        accessibilityLabel={t("fleet.depot.name")}
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (failure === "taken") clear();
        }}
        placeholder={t("fleet.depot.namePlaceholder")}
        maxLength={MAX_DEPOT_NAME + 10}
        autoFocus={!depot}
        autoCorrect={false}
        error={failure === "taken" ? t("fleet.depot.taken") : undefined}
      />
      {failureAlert}
      <View className="gap-3">
        <Button
          title={t("fleet.save")}
          disabled={!changed}
          loading={saving}
          onPress={() =>
            valid && void run(() => (depot ? actions.renameDepot(depot.id, valid) : actions.addDepot(valid)))
          }
        />
        {depot ? (
          <Button
            title={t("fleet.depot.archive")}
            variant="destructive"
            disabled={saving}
            onPress={() =>
              activeCars > 0
                ? void run(async () => "depotHasCars")
                : confirm(t("fleet.depot.confirmTitle"), t("fleet.confirmBody"), () =>
                    void run(() => actions.archiveDepot(depot.id, true)),
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
