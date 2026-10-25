import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { FirmInvitation } from "@/auth";
import { useTranslation } from "@/i18n";

import { Alert } from "./alert";
import { Button } from "./button";
import { Icon } from "./icon";
import { Surface } from "./surface";
import { ThemedText } from "./themed-text";

// Signed in, but not a member of any firm yet: pending invitations to accept, or a way to check again.
export function NoFirm({
  invitations,
  onAccept,
  onRefresh,
  onSignOut,
}: {
  invitations: FirmInvitation[];
  /** Resolves false when accepting failed. */
  onAccept: (id: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const accept = async (id: string) => {
    setBusy(id);
    setFailed(false);
    if (!(await onAccept(id))) setFailed(true);
    setBusy(null);
  };

  const refresh = async () => {
    setBusy("refresh");
    await onRefresh();
    setBusy(null);
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="gap-6 px-4 pb-8"
      contentContainerStyle={{ paddingTop: insets.top + 32 }}
    >
      <View className="gap-3">
        <View className="size-ghost items-center justify-center rounded-full bg-secondary-soft">
          <Icon name="depot" color="secondary-ink" />
        </View>
        <ThemedText variant="heading" accessibilityRole="header">
          {t("firm.none.title")}
        </ThemedText>
        <ThemedText variant="body">{t("firm.none.body")}</ThemedText>
      </View>

      {invitations.map((invitation) => (
        <Surface key={invitation.id} className="gap-4 p-5">
          <ThemedText variant="title">{t("firm.none.invitation", { firm: invitation.firmName })}</ThemedText>
          <Button
            title={t("firm.none.accept")}
            loading={busy === invitation.id}
            disabled={busy !== null && busy !== invitation.id}
            onPress={() => void accept(invitation.id)}
          />
        </Surface>
      ))}
      {failed ? <Alert tone="danger" message={t("firm.none.acceptFailed")} /> : null}

      <View className="gap-3">
        <Button
          title={t("firm.none.refresh")}
          variant="secondary"
          loading={busy === "refresh"}
          disabled={busy !== null && busy !== "refresh"}
          onPress={() => void refresh()}
        />
        <Button title={t("profile.signOut")} variant="destructive" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}
