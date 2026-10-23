import { router } from "expo-router";
import { View } from "react-native";

import { useTranslation } from "@/i18n";

import { Button } from "./button";
import { ThemedText } from "./themed-text";

// Stand-in for the sign-in and sign-up screens until Clerk is set up.
export function AuthPlaceholder({ screen }: { screen: "signIn" | "signUp" }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 gap-3 bg-canvas px-4 pt-6">
      <ThemedText variant="heading" accessibilityRole="header">
        {t(`auth.${screen}.heading`)}
      </ThemedText>
      <ThemedText variant="body">{t(`auth.${screen}.body`)}</ThemedText>
      <Button
        title={t("auth.backToStart")}
        variant="secondary"
        onPress={() => router.dismissTo("/onboarding")}
        className="mt-3"
      />
    </View>
  );
}
