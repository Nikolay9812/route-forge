import { NativeTabs } from "expo-router/native-tabs";
import { ActivityIndicator, View } from "react-native";

import { isReviewer, useAuth, useFirm } from "@/auth";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { icons, type IconName } from "@/components/icons";
import { NoFirm } from "@/components/no-firm";
import { useTranslation, type TranslationKey } from "@/i18n";
import { useFontScript, useThemeColor, type FontScript } from "@/theme";

// Couriers log their own work; dispatchers and owners review it; mechanics look after the cars. Profile is everyone's.
const tabs = [
  { name: "home", icon: "home", label: "tabs.home", for: "courier" },
  { name: "shifts", icon: "shifts", label: "tabs.shifts", for: "courier" },
  { name: "pay", icon: "salary", label: "tabs.pay", for: "courier" },
  { name: "approvals", icon: "approvals", label: "tabs.approvals", for: "reviewer" },
  { name: "team", icon: "team", label: "tabs.team", for: "reviewer" },
  { name: "cars", icon: "car", label: "tabs.cars", for: "mechanic" },
  { name: "profile", icon: "profile", label: "tabs.profile", for: "everyone" },
] as const satisfies readonly {
  name: string;
  icon: IconName;
  label: TranslationKey;
  for: "courier" | "reviewer" | "mechanic" | "everyone";
}[];

const labelFont: Record<FontScript, string> = {
  latin: "PlusJakartaSans-SemiBold",
  cyrillic: "Manrope-SemiBold",
};

// The platform's own tab bar: switching tabs is instant, with no animation of ours. iOS keeps the system material.
// The tabs need an active firm and the role in it: until then, a spinner (activating the firm, asking for the role),
// the "No firm yet" screen, or an error with Retry when the role couldn't be loaded.
export default function AppLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { firm, refresh, retry, accept } = useFirm();
  const fontFamily = labelFont[useFontScript()];
  const selected = useThemeColor("secondary-ink");
  const muted = useThemeColor("ink-muted");
  const surface = useThemeColor("surface");
  const indicator = useThemeColor("secondary-soft");

  if (firm.status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color={selected} />
      </View>
    );
  }
  if (firm.status === "none") {
    return <NoFirm invitations={firm.invitations} onAccept={accept} onRefresh={refresh} onSignOut={signOut} />;
  }
  if (firm.status === "error") {
    return (
      <View className="flex-1 justify-center gap-3 bg-canvas px-4">
        <Alert
          tone={firm.code === "offline" ? "offline" : "danger"}
          message={firm.code === "offline" ? t("firm.roleFailed.offline") : t("firm.roleFailed.error")}
        />
        <Button title={t("firm.roleFailed.retry")} variant="secondary" onPress={retry} />
      </View>
    );
  }
  const audience = isReviewer(firm.role) ? "reviewer" : firm.role === "mechanic" ? "mechanic" : "courier";

  return (
    <NativeTabs
      tintColor={selected}
      iconColor={{ default: muted, selected }}
      labelStyle={{ default: { fontFamily, color: muted }, selected: { fontFamily, color: selected } }}
      backgroundColor={surface}
      indicatorColor={indicator}
    >
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name} hidden={tab.for !== "everyone" && tab.for !== audience}>
          <NativeTabs.Trigger.Icon sf={icons[tab.icon].ios} md={icons[tab.icon].android} />
          <NativeTabs.Trigger.Label>{t(tab.label)}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
