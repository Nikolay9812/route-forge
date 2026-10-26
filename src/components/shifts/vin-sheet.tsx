import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";
import { validVin } from "@/domain/fleet";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

import { useCopyVin } from "./vin-row";

const QR_SIZE = 240;

// The shift car's VIN as a big QR code to scan with another app, plus Copy. The code follows the theme: ink on the
// surface, so light on dark in dark mode. A link with no valid VIN closes the sheet.
export function VinSheet() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ vin?: string; plate?: string }>();
  const vin = validVin(params.vin) ?? "";
  const { copied, copy } = useCopyVin(vin);
  const paper = useThemeColor("surface");
  const ink = useThemeColor("ink");

  useEffect(() => {
    if (!vin) router.back();
  }, [vin]);
  if (!vin) return null;

  return (
    <View className="gap-5 bg-surface px-6 pt-8" style={{ paddingBottom: insets.bottom + 24 }}>
      <View className="gap-2">
        <ThemedText variant="heading" accessibilityRole="header">
          {t("shifts.vin.title")}
        </ThemedText>
        <ThemedText variant="footnote">{t("shifts.vin.body")}</ThemedText>
      </View>
      <View
        className="items-center self-center rounded-md border border-border p-4"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${t("shifts.vin.label")} ${vin}`}
      >
        <QRCode value={vin} size={QR_SIZE} color={ink} backgroundColor={paper} quietZone={16} ecl="M" />
      </View>
      <View className="items-center gap-0.5">
        <ThemedText variant="title" selectable style={{ fontVariant: ["tabular-nums"] }}>
          {vin}
        </ThemedText>
        {params.plate ? <ThemedText variant="footnote">{params.plate}</ThemedText> : null}
      </View>
      <Button
        title={copied ? t("shifts.vin.copied") : t("shifts.vin.copy")}
        variant="secondary"
        onPress={() => void copy()}
      />
    </View>
  );
}
