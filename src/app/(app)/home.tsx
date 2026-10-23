import { View } from "react-native";

import { useAuth } from "@/auth";
import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

// Placeholder until the real home screen exists. Signing out flips the auth guard back to onboarding.
export default function Home() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center gap-2 bg-canvas px-4">
      <ThemedText variant="heading" accessibilityRole="header" className="text-center">
        {t("home.signedInAs", { name: user?.fullName ?? "" })}
      </ThemedText>
      <ThemedText variant="body">{user?.emailAddress}</ThemedText>
      <Button title={t("home.signOut")} variant="secondary" onPress={signOut} className="mt-6" />
    </View>
  );
}
