import { NativeTabs } from "expo-router/native-tabs";

import { icons, type IconName } from "@/components/icons";
import { useTranslation, type TranslationKey } from "@/i18n";
import { useFontScript, useThemeColor, type FontScript } from "@/theme";

const tabs = [
  { name: "home", icon: "home", label: "tabs.home" },
  { name: "shifts", icon: "shifts", label: "tabs.shifts" },
  { name: "pay", icon: "salary", label: "tabs.pay" },
  { name: "profile", icon: "profile", label: "tabs.profile" },
] as const satisfies readonly { name: string; icon: IconName; label: TranslationKey }[];

const labelFont: Record<FontScript, string> = {
  latin: "PlusJakartaSans-SemiBold",
  cyrillic: "Manrope-SemiBold",
};

// The platform's own tab bar: switching tabs is instant, with no animation of ours. iOS keeps the system material.
export default function AppLayout() {
  const { t } = useTranslation();
  const fontFamily = labelFont[useFontScript()];
  const selected = useThemeColor("secondary-ink");
  const muted = useThemeColor("ink-muted");

  return (
    <NativeTabs
      tintColor={selected}
      iconColor={{ default: muted, selected }}
      labelStyle={{ default: { fontFamily, color: muted }, selected: { fontFamily, color: selected } }}
      backgroundColor={useThemeColor("surface")}
      indicatorColor={useThemeColor("secondary-soft")}
    >
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon sf={icons[tab.icon].ios} md={icons[tab.icon].android} />
          <NativeTabs.Trigger.Label>{t(tab.label)}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
