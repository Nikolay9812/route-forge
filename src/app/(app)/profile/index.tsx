import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, useFirm } from "@/auth";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { initials } from "@/components/home/format";
import { Icon } from "@/components/icon";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

// Signing out flips the auth guard back to onboarding. Owners also get the firm's depots and cars and pay rates.
export default function Profile() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { firm } = useFirm();
  const owner = firm.status === "ready" && firm.role === "owner";
  const [signingOut, setSigningOut] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Still mounted only if sign-out failed (e.g. offline); let the user try again.
      setSigningOut(false);
    }
  }

  return (
    <View className="flex-1 gap-6 bg-canvas px-4" style={{ paddingTop: insets.top + 24 }}>
      <View className="items-center gap-2">
        <View className="mb-2 size-button items-center justify-center rounded-full bg-primary-soft">
          <ThemedText variant="heading">{initials(user?.fullName ?? "")}</ThemedText>
        </View>
        <ThemedText variant="heading" accessibilityRole="header" className="text-center">
          {user?.fullName}
        </ThemedText>
        <ThemedText variant="body">{user?.emailAddress}</ThemedText>
      </View>
      {owner ? (
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("profile.firm")}
          </ThemedText>
          <Surface className="overflow-hidden">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/profile/fleet")}
              className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
            >
              <Icon name="depot" color="ink" />
              <ThemedText variant="body" color="ink" className="flex-1">
                {t("fleet.title")}
              </ThemedText>
              <Icon name="chevron" size="sm" color="ink-muted" />
            </Pressable>
            <Divider className="mx-4" />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/profile/pay-rates")}
              className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
            >
              <Icon name="salary" color="ink" />
              <ThemedText variant="body" color="ink" className="flex-1">
                {t("payRates.title")}
              </ThemedText>
              <Icon name="chevron" size="sm" color="ink-muted" />
            </Pressable>
          </Surface>
        </View>
      ) : null}
      <Button title={t("profile.signOut")} variant="secondary" loading={signingOut} onPress={handleSignOut} />
    </View>
  );
}
