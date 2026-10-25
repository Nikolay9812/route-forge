import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth";
import { Button } from "@/components/button";
import { initials } from "@/components/home/format";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

// Signing out flips the auth guard back to onboarding.
export default function Profile() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
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
      <Button title={t("profile.signOut")} variant="secondary" loading={signingOut} onPress={handleSignOut} />
    </View>
  );
}
