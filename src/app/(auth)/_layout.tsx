import { Stack } from "expo-router";

import { useTranslation } from "@/i18n";

export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="sign-in" options={{ title: t("auth.signIn.title") }} />
      <Stack.Screen name="sign-up" options={{ title: t("auth.signUp.title") }} />
    </Stack>
  );
}
