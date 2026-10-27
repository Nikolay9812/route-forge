import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import { IconButton } from "@/components/icon-button";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

/** Copies the VIN; `copied` stays true for 2 s so the button can say so. */
export function useCopyVin(vin: string) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    await Clipboard.setStringAsync(vin);
    setCopied(true);
    AccessibilityInfo.announceForAccessibility(t("shifts.vin.copiedAnnounce"));
  };
  return { copied, copy };
}

// The VIN of the shift's car, as the owner entered it: show it as a QR code (the stack's `vin` sheet, `shifts/vin` unless
// told otherwise) or copy it.
export function VinRow({
  vin,
  plate,
  qrSheet = "/shifts/vin",
}: {
  vin: string;
  plate: string;
  qrSheet?: "/shifts/vin" | "/cars/vin";
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopyVin(vin);
  return (
    <View className="h-field-labeled flex-row items-center gap-1 rounded-md bg-canvas pl-3.5 pr-1">
      <View className="flex-1 gap-0.5">
        <ThemedText variant="caption">{t("shifts.vin.label")}</ThemedText>
        <ThemedText variant="body" numberOfLines={1} selectable style={{ fontVariant: ["tabular-nums"] }}>
          {vin}
        </ThemedText>
      </View>
      <IconButton
        icon="qr"
        size="sm"
        accessibilityLabel={t("shifts.vin.showQr")}
        onPress={() => router.push({ pathname: qrSheet, params: { vin, plate } })}
      />
      <IconButton
        icon={copied ? "check" : "copy"}
        size="sm"
        accessibilityLabel={copied ? t("shifts.vin.copied") : t("shifts.vin.copy")}
        onPress={() => void copy()}
      />
    </View>
  );
}
