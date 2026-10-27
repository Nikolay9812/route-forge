import { router, Stack, useLocalSearchParams } from "expo-router";
import { Fragment, useState } from "react";
import { ScrollView, View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { ActionSheet } from "@/components/action-sheet";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { Notice } from "@/components/notice";
import { SegmentedControl } from "@/components/segmented-control";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { Toggle } from "@/components/toggle";
import type { AssignableRole } from "@/domain/people";
import type { Person } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { usePeople, usePeopleActions } from "@/people/people";

type Confirm = { kind: "role"; role: AssignableRole } | { kind: "remove" };

// One courier or dispatcher for the owner: switch the role (confirmed first), pick a dispatcher's depots, or remove
// them from the firm (confirmed first). Failures stay on screen with the choices as the owner left them.
export default function PersonScreen() {
  const { t } = useTranslation();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { resource, reload } = usePeople();
  const actions = usePeopleActions();
  const person = actions.person(userId);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const act = async (change: () => Promise<ApiFailure | null>, done?: () => void) => {
    setBusy(true);
    setFailure(null);
    const result = await change();
    setBusy(false);
    setFailure(result);
    if (!result) done?.();
  };

  if (resource.status !== "ready") {
    return (
      <View className="flex-1 gap-3 bg-canvas px-4 pt-4">
        <Stack.Screen options={{ title: "" }} />
        {resource.status === "failed" ? (
          <>
            <Alert
              tone={resource.failure === "offline" ? "offline" : "danger"}
              message={resource.failure === "offline" ? t("people.offline") : t("people.error")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
          </>
        ) : null}
      </View>
    );
  }
  if (!person || person.role === "owner") {
    return (
      <View className="flex-1 gap-4 bg-canvas px-4 pt-4">
        <Stack.Screen options={{ title: "" }} />
        <Notice icon="team" title={t("people.person.missingTitle")} body={t("people.person.missingBody")} />
        <Button title={t("people.person.back")} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }
  const role = person.role;

  return (
    <>
      <Stack.Screen options={{ title: person.name }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 px-4 pt-4 pb-8"
      >
        <View className="gap-1">
          <ThemedText variant="heading" accessibilityRole="header">
            {person.name}
          </ThemedText>
          <ThemedText variant="body">{person.email}</ThemedText>
        </View>
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("people.person.role")}
          </ThemedText>
          <SegmentedControl<AssignableRole>
            options={[
              { value: "courier", label: t("people.roles.courier") },
              { value: "dispatcher", label: t("people.roles.dispatcher") },
            ]}
            value={role}
            onChange={(next) => !busy && next !== role && setConfirm({ kind: "role", role: next })}
          />
          <ThemedText variant="footnote" className="ml-1">
            {t("people.person.roleNote")}
          </ThemedText>
        </View>
        {failure ? (
          <Alert
            tone={failure === "offline" ? "offline" : "danger"}
            message={failure === "offline" ? t("people.saveOffline") : t("people.saveError")}
          />
        ) : null}
        {role === "dispatcher" ? (
          <DepotPicker
            // A fresh picker when the saved depots change, so it starts from what's stored.
            key={person.depotIds.join(",")}
            person={person}
            depots={resource.data.depots}
            busy={busy}
            onSave={(ids) => void act(() => actions.setDepots(person.userId, ids))}
          />
        ) : null}
        <Button
          title={t("people.person.remove")}
          variant="destructive"
          disabled={busy}
          onPress={() => setConfirm({ kind: "remove" })}
        />
      </ScrollView>
      <ActionSheet
        visible={confirm !== null}
        title={
          confirm?.kind === "remove"
            ? t("people.person.removeTitle", { name: person.name })
            : t(confirm?.role === "dispatcher" ? "people.person.toDispatcher" : "people.person.toCourier", {
                name: person.name,
              })
        }
        actions={[
          confirm?.kind === "remove"
            ? {
                label: t("people.person.removeConfirm"),
                destructive: true,
                onPress: () => void act(() => actions.remove(person.userId), () => router.back()),
              }
            : {
                label: t("people.person.changeRole"),
                onPress: () => confirm && void act(() => actions.setRole(person.userId, confirm.role)),
              },
        ]}
        cancelLabel={t("people.cancel")}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

/** A dispatcher's active depots as toggles; Save sends the whole set once something changed. */
function DepotPicker({
  person,
  depots,
  busy,
  onSave,
}: {
  person: Person;
  depots: { id: string; name: string }[];
  busy: boolean;
  onSave: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(() => new Set(person.depotIds));
  const changed = picked.size !== person.depotIds.length || person.depotIds.some((id) => !picked.has(id));

  const toggle = (id: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <View className="gap-2">
      <ThemedText variant="footnote" className="ml-1">
        {t("people.person.depots")}
      </ThemedText>
      {depots.length === 0 ? (
        <ThemedText variant="body" color="ink-muted">
          {t("people.person.noActiveDepots")}
        </ThemedText>
      ) : (
        <>
          <Surface className="overflow-hidden">
            {depots.map((depot, i) => (
              <Fragment key={depot.id}>
                {i > 0 ? <Divider className="mx-4" /> : null}
                <View className="min-h-11 flex-row items-center gap-3 px-4 py-3">
                  <ThemedText variant="body" color="ink" className="flex-1" numberOfLines={1}>
                    {depot.name}
                  </ThemedText>
                  <Toggle
                    value={picked.has(depot.id)}
                    onValueChange={(on) => toggle(depot.id, on)}
                    disabled={busy}
                    accessibilityLabel={depot.name}
                  />
                </View>
              </Fragment>
            ))}
          </Surface>
          <ThemedText variant="footnote" className="ml-1">
            {t("people.person.depotsNote")}
          </ThemedText>
          <Button
            title={t("people.person.saveDepots")}
            disabled={!changed}
            loading={busy}
            onPress={() => onSave(depots.filter((d) => picked.has(d.id)).map((d) => d.id))}
          />
        </>
      )}
    </View>
  );
}
