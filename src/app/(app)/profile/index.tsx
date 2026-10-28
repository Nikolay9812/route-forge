import { router, type Href } from "expo-router";
import { Fragment, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useAuth, useFirm } from "@/auth";
import { ActionSheet } from "@/components/action-sheet";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { SectionRows } from "@/components/documents/section-rows";
import { initials } from "@/components/home/format";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import type { IconName } from "@/components/icons";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useDocuments } from "@/documents/documents";
import { useTranslation } from "@/i18n";
import { useToggleColorScheme } from "@/theme";

// The moon/sun button switches light/dark for the whole app (remembered on the device).
// Signing out flips the auth guard back to onboarding. Couriers get their documents; owners get the firm's depots
// and cars, the service log, pay rates, people and couriers, after Firm settings. Mechanics get nothing more here.
// Everyone gets Delete account at the bottom (the server refuses owners).
export default function Profile() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { firm } = useFirm();
  const role = firm.status === "ready" ? firm.role : null;
  const [signingOut, setSigningOut] = useState(false);
  const insets = useSafeAreaInsets();
  const colorScheme = useToggleColorScheme();

  const api = useApi();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailure, setDeleteFailure] = useState<ApiFailure | null>(null);

  // The server deletes the account; signing out then only clears this device's session.
  async function handleDelete() {
    setDeleting(true);
    setDeleteFailure(null);
    try {
      await api("/api/me", { method: "DELETE" });
    } catch (error) {
      setDeleteFailure(failureOf(error));
      setDeleting(false);
      return;
    }
    await signOut().catch(() => {});
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Still mounted only if sign-out failed (e.g. offline); let the user try again.
      setSigningOut(false);
    }
  }

  const firmRows: { icon: IconName; title: string; href: Href }[] = [
    { icon: "settings", title: t("firmSettings.title"), href: "/profile/firm" },
    { icon: "depot", title: t("fleet.title"), href: "/profile/fleet" },
    { icon: "wrench", title: t("carNotes.title"), href: "/profile/service-log" },
    { icon: "salary", title: t("payRates.title"), href: "/profile/pay-rates" },
    { icon: "people-add", title: t("profile.people"), href: "/profile/people" },
    { icon: "team", title: t("profile.couriers"), href: "/profile/couriers" },
  ];

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="gap-6 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 32 }}
    >
      <View className="relative items-center gap-2">
        {colorScheme ? (
          <IconButton
            variant="outline"
            icon={colorScheme.scheme === "dark" ? "light-mode" : "dark-mode"}
            accessibilityLabel={t(colorScheme.scheme === "dark" ? "profile.lightMode" : "profile.darkMode")}
            onPress={colorScheme.toggle}
            className="absolute right-0 top-0"
          />
        ) : null}
        <View className="mb-2 size-button items-center justify-center rounded-full bg-primary-soft">
          <ThemedText variant="heading">{initials(user?.fullName ?? "")}</ThemedText>
        </View>
        <ThemedText variant="heading" accessibilityRole="header" className="text-center">
          {user?.fullName}
        </ThemedText>
        <ThemedText variant="body">{user?.emailAddress}</ThemedText>
      </View>
      {role === "courier" ? <MyDocuments /> : null}
      {role === "owner" ? (
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {t("profile.firm")}
          </ThemedText>
          <Surface className="overflow-hidden">
            {firmRows.map((row, i) => (
              <Fragment key={row.title}>
                {i > 0 ? <Divider className="mx-4" /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(row.href)}
                  className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
                >
                  <Icon name={row.icon} color="ink" />
                  <ThemedText variant="body" color="ink" className="flex-1">
                    {row.title}
                  </ThemedText>
                  <Icon name="chevron" size="sm" color="ink-muted" />
                </Pressable>
              </Fragment>
            ))}
          </Surface>
        </View>
      ) : null}
      <Button title={t("profile.signOut")} variant="secondary" loading={signingOut} onPress={handleSignOut} />
      <Button title={t("profile.privacy")} variant="secondary" size="sm" onPress={() => router.push("/privacy")} />
      {deleteFailure ? (
        <Alert
          tone={deleteFailure === "offline" ? "offline" : "danger"}
          message={t(
            deleteFailure === "offline"
              ? "profile.deleteOffline"
              : deleteFailure === "notEditable"
                ? "profile.deleteOwner"
                : "profile.deleteError",
          )}
        />
      ) : null}
      <Button
        title={t("profile.deleteAccount")}
        variant="destructive"
        loading={deleting}
        onPress={() => setConfirmDelete(true)}
      />
      <ActionSheet
        visible={confirmDelete}
        title={t("profile.deleteTitle")}
        actions={[{ label: t("profile.deleteConfirm"), destructive: true, onPress: () => void handleDelete() }]}
        cancelLabel={t("profile.cancel")}
        onClose={() => setConfirmDelete(false)}
      />
    </ScrollView>
  );
}

/** The courier's own document sections, each opening its form. */
function MyDocuments() {
  const { t } = useTranslation();
  const { resource, reload } = useDocuments();
  return (
    <View className="gap-2">
      <ThemedText variant="footnote" className="ml-1">
        {t("profile.myDocuments")}
      </ThemedText>
      {resource.status === "loading" ? (
        <DocumentsSkeleton rows={1} />
      ) : resource.status === "failed" ? (
        <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />
      ) : (
        <SectionRows
          documents={resource.data}
          onOpen={(section) => router.push({ pathname: "/profile/document", params: { section } })}
        />
      )}
    </View>
  );
}
