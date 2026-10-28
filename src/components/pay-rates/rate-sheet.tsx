import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert as NativeAlert, View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { DateField } from "@/components/date-field";
import { FleetSheet, useSheetSave } from "@/components/fleet/sheet";
import { useFormat } from "@/components/home/format";
import { SegmentedControl } from "@/components/segmented-control";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { addMonths } from "@/domain/calendar";
import { monthOf } from "@/domain/dates";
import { formatAmountInput, parseAmount, type RateKind } from "@/domain/pay-rates";
import { useTranslation } from "@/i18n";
import { useDisplayName } from "@/people/display-name";
import { usePayRateActions } from "@/pay-rates/pay-rates";

// Schedule a rate change for the firm default (no userId) or a courier, or edit or cancel an upcoming one (`id`).
// A start date before the firm's today changes approved pay, so saving it asks first.
export function RateSheet() {
  const { t } = useTranslation();
  const displayName = useDisplayName();
  const params = useLocalSearchParams<{ userId?: string; id?: string }>();
  const actions = usePayRateActions(params.userId);
  const entry = actions.entry(params.id);
  const today = actions.data?.today ?? "";
  const firm = actions.data?.firm;
  const format = useFormat(firm?.timeZone ?? "UTC", firm?.currency ?? "EUR");

  const [kind, setKind] = useState<RateKind>(entry?.kind ?? actions.target?.current?.kind ?? "hourly");
  const [amount, setAmount] = useState(entry?.amountMinor ? formatAmountInput(entry.amountMinor) : "");
  const [date, setDate] = useState(entry?.effectiveFrom ?? `${addMonths(monthOf(today), 1)}-01`);
  const { saving, failure, run, clear } = useSheetSave();

  // Opened for an entry that has started or no longer exists: nothing to edit. Decided once on open, since the
  // entry later disappearing is this sheet's own cancel, which already closes it.
  const [missing] = useState(() => params.id !== undefined && !entry?.upcoming);
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  const amountMinor = kind === "firm" ? null : parseAmount(amount);
  const valid = kind === "firm" || amountMinor !== null;
  const changed =
    !entry || entry.kind !== kind || entry.amountMinor !== amountMinor || entry.effectiveFrom !== date;
  const past = today !== "" && date < today;
  const amountError = amount.trim() !== "" && kind !== "firm" && amountMinor === null;

  const save = () => {
    if (!valid) return;
    const input = { effectiveFrom: date, kind, amountMinor };
    const write = () => void run(() => (entry ? actions.update(entry.id, input) : actions.create(input)));
    if (!past) return write();
    NativeAlert.alert(
      t("payRates.sheet.pastConfirmTitle"),
      t("payRates.sheet.pastConfirmBody", { date: format.shortDay(date) }),
      [
        { text: t("fleet.cancel"), style: "cancel" },
        { text: t("payRates.sheet.pastConfirmAction"), style: "destructive", onPress: write },
      ],
    );
  };

  const cancelChange = () => {
    if (!entry) return;
    NativeAlert.alert(t("payRates.sheet.cancelConfirmTitle"), t("payRates.sheet.cancelConfirmBody"), [
      { text: t("payRates.sheet.keep"), style: "cancel" },
      {
        text: t("payRates.sheet.cancelConfirmAction"),
        style: "destructive",
        onPress: () => void run(() => actions.remove(entry.id)),
      },
    ]);
  };

  const kinds: { value: RateKind; label: string }[] = [
    { value: "hourly", label: t("payRates.hourly") },
    { value: "daily", label: t("payRates.daily") },
    ...(params.userId ? [{ value: "firm" as const, label: t("payRates.firmDefault") }] : []),
  ];

  return (
    <FleetSheet
      title={t(entry ? "payRates.sheet.editTitle" : "payRates.sheet.newTitle")}
      body={params.userId ? actions.name === undefined ? undefined : displayName(actions.name) : t("payRates.firmDefault")}
    >
      <SegmentedControl
        options={kinds}
        value={kind}
        onChange={(next) => {
          setKind(next);
          clear();
        }}
      />
      {kind !== "firm" ? (
        <View className="gap-1">
          <TextField
            label={t("payRates.sheet.amount")}
            accessibilityLabel={t("payRates.sheet.amount")}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            autoFocus={!entry}
            maxLength={8}
            error={amountError ? t("payRates.sheet.amountInvalid") : undefined}
          />
          {!amountError ? (
            <ThemedText variant="footnote" className="ml-1">
              {t(kind === "daily" ? "payRates.sheet.perShiftHint" : "payRates.sheet.perHourHint", {
                currency: firm?.currency ?? "",
              })}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <View className="gap-1">
        <DateField
          label={t("payRates.sheet.startsOn")}
          value={date}
          display={format.shortDay(date)}
          onChange={(next) => {
            setDate(next);
            if (failure === "taken") clear();
          }}
        />
        {failure === "taken" ? (
          <ThemedText variant="footnote" weight="regular" color="danger" className="ml-1">
            {t("payRates.sheet.taken")}
          </ThemedText>
        ) : null}
      </View>
      {past ? <Alert tone="danger" message={t("payRates.sheet.pastWarning", { date: format.shortDay(date) })} /> : null}
      {failure === "offline" ? (
        <Alert tone="offline" message={t("fleet.saveOffline")} />
      ) : failure === "notEditable" ? (
        <Alert tone="danger" message={t("payRates.sheet.notEditable")} />
      ) : failure && failure !== "taken" ? (
        <Alert tone="danger" message={t("fleet.saveError")} />
      ) : null}
      <View className="gap-3">
        <Button title={t("fleet.save")} disabled={!valid || !changed} loading={saving} onPress={save} />
        {entry ? (
          <Button title={t("payRates.sheet.cancelChange")} variant="destructive" disabled={saving} onPress={cancelChange} />
        ) : (
          <Button title={t("fleet.cancel")} variant="secondary" disabled={saving} onPress={() => router.back()} />
        )}
      </View>
    </FleetSheet>
  );
}
