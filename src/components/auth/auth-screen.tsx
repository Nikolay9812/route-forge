import { router } from "expo-router";
import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/icon-button";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

/** Shared frame for the auth screens: back button and wordmark, title, intro, then the form. */
export function AuthScreen({ title, intro, children }: PropsWithChildren<{ title: string; intro: string }>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-surface">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow px-4"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="mt-2 h-ghost flex-row items-center justify-between">
          <IconButton
            icon="back"
            variant="outline"
            size="sm"
            accessibilityLabel={t("auth.back")}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/onboarding"))}
          />
          <ThemedText variant="heading" weight="extrabold">
            {t("app.name")}
          </ThemedText>
        </View>
        <ThemedText variant="display" accessibilityRole="header" className="mt-6">
          {title}
        </ThemedText>
        <ThemedText variant="body" className="mt-2">
          {intro}
        </ThemedText>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
