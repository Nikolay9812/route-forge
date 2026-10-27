import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { ActionSheet } from "@/components/action-sheet";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { DateField } from "@/components/date-field";
import { FleetSheet, useSheetSave } from "@/components/fleet/sheet";
import { clock, useFormat } from "@/components/home/format";
import { Stepper } from "@/components/stepper";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { Toggle } from "@/components/toggle";
import { addMonths } from "@/domain/calendar";
import { monthOf } from "@/domain/dates";
import {
  DEFAULT_SETTINGS,
  LAW_DEFAULTS,
  MAX_BREAK_MINUTES,
  parseClock,
  validRule,
} from "@/domain/firm";
import { formatAmountInput, parseAmount } from "@/domain/pay-rates";
import type { WorkRule } from "@/domain/types";
import { useFirmActions } from "@/firm/firm-settings";
import { useTranslation } from "@/i18n";

const BREAK_STEP = 15;

// Schedule a break and Spesen rule from a day, or edit or cancel an upcoming one (`id`). Every field is saved
// whole. A start date before the firm's today changes approved hours and pay, so saving it asks first.
export function RulesSheet() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const actions = useFirmActions();
  const entry = actions.entry(params.id);
  const data = actions.data;
  const today = data?.today ?? "";
  const format = useFormat(
    data?.timeZone ?? DEFAULT_SETTINGS.timeZone,
    data?.currency ?? DEFAULT_SETTINGS.currency,
  );
  const start: Omit<WorkRule, "effectiveFrom"> =
    entry ?? data?.next ?? data?.rule ?? LAW_DEFAULTS;

  const [breakAfter, setBreakAfter] = useState(clock(start.breakAfterMinutes));
  const [breakMinutes, setBreakMinutes] = useState(start.breakMinutes);
  const [longAfter, setLongAfter] = useState(
    clock(start.longBreakAfterMinutes),
  );
  const [longMinutes, setLongMinutes] = useState(start.longBreakMinutes);
  const [paySpesen, setPaySpesen] = useState(start.spesenMinor > 0);
  const [spesenAfter, setSpesenAfter] = useState(
    clock(start.spesenAfterMinutes),
  );
  const [amount, setAmount] = useState(
    formatAmountInput(start.spesenMinor || LAW_DEFAULTS.spesenMinor),
  );
  const [date, setDate] = useState(
    entry?.effectiveFrom ?? `${addMonths(monthOf(today), 1)}-01`,
  );
  const [confirm, setConfirm] = useState<"past" | "cancel" | null>(null);
  const { saving, failure, run, clear } = useSheetSave();

  // Opened for an entry that has started or no longer exists: nothing to edit (decided once, as in the rate sheet).
  const [missing] = useState(() => params.id !== undefined && !entry?.upcoming);
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  const clocks = {
    breakAfter: parseClock(breakAfter),
    longAfter: parseClock(longAfter),
    spesenAfter: paySpesen ? parseClock(spesenAfter) : start.spesenAfterMinutes,
  };
  const spesenMinor = paySpesen ? parseAmount(amount) : 0;
  const rule: WorkRule | null =
    clocks.breakAfter !== null &&
    clocks.longAfter !== null &&
    clocks.spesenAfter !== null &&
    spesenMinor !== null
      ? {
          effectiveFrom: date,
          breakAfterMinutes: clocks.breakAfter,
          breakMinutes,
          longBreakAfterMinutes: clocks.longAfter,
          longBreakMinutes: longMinutes,
          spesenAfterMinutes: clocks.spesenAfter,
          spesenMinor,
        }
      : null;
  const valid = rule !== null && validRule(rule);
  // Every clock and the amount parse, but they don't fit together (e.g. the longer break starts first).
  const mismatch = rule !== null && !valid;
  const changed =
    !entry ||
    !rule ||
    (Object.keys(rule) as (keyof WorkRule)[]).some(
      (key) => rule[key] !== entry[key],
    );
  const past = today !== "" && date < today;
  const clockError = (text: string) =>
    parseClock(text) === null
      ? t("firmSettings.sheet.clockInvalid")
      : undefined;

  const write = () => {
    if (!rule || !valid) return;
    void run(() =>
      entry ? actions.update(entry.id, rule) : actions.create(rule),
    );
  };

  const edited = (set: (value: string) => void) => (value: string) => {
    set(value);
    clear();
  };

  const stepperLabels = {
    decrementLabel: t("firmSettings.sheet.decrease"),
    incrementLabel: t("firmSettings.sheet.increase"),
  };

  return (
    <FleetSheet
      title={t(
        entry ? "firmSettings.sheet.editTitle" : "firmSettings.sheet.newTitle",
      )}
      body={t("firmSettings.sheet.body")}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <TextField
            label={t("firmSettings.sheet.breakAfter")}
            accessibilityLabel={t("firmSettings.sheet.breakAfter")}
            value={breakAfter}
            onChangeText={edited(setBreakAfter)}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            error={clockError(breakAfter)}
          />
        </View>
        {/* Stepper aligns itself to the start, so a wrapper centres it against the field. */}
        <View>
          <Stepper
            value={breakMinutes}
            onChange={(value) => {
              setBreakMinutes(value);
              clear();
            }}
            max={MAX_BREAK_MINUTES}
            step={BREAK_STEP}
            accessibilityLabel={t("firmSettings.sheet.breakMinutes")}
            {...stepperLabels}
          />
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <TextField
            label={t("firmSettings.sheet.longBreakAfter")}
            accessibilityLabel={t("firmSettings.sheet.longBreakAfter")}
            value={longAfter}
            onChangeText={edited(setLongAfter)}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            error={clockError(longAfter)}
          />
        </View>
        {/* Stepper aligns itself to the start, so a wrapper centres it against the field. */}
        <View>
          <Stepper
            value={longMinutes}
            onChange={(value) => {
              setLongMinutes(value);
              clear();
            }}
            max={MAX_BREAK_MINUTES}
            step={BREAK_STEP}
            accessibilityLabel={t("firmSettings.sheet.longBreakMinutes")}
            {...stepperLabels}
          />
        </View>
      </View>
      <ThemedText variant="footnote" className="ml-1">
        {t("firmSettings.sheet.minutesHint")}
      </ThemedText>
      {mismatch ? (
        <Alert tone="danger" message={t("firmSettings.sheet.mismatch")} />
      ) : null}

      <View className="flex-row items-center justify-between gap-3">
        <ThemedText variant="body" color="ink">
          {t("firmSettings.sheet.paySpesen")}
        </ThemedText>
        <Toggle
          accessibilityLabel={t("firmSettings.sheet.paySpesen")}
          value={paySpesen}
          onValueChange={(value) => {
            setPaySpesen(value);
            clear();
          }}
        />
      </View>
      {paySpesen ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <TextField
              label={t("firmSettings.sheet.spesenAfter")}
              accessibilityLabel={t("firmSettings.sheet.spesenAfter")}
              value={spesenAfter}
              onChangeText={edited(setSpesenAfter)}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              error={clockError(spesenAfter)}
            />
          </View>
          <View className="flex-1">
            <TextField
              label={t("firmSettings.sheet.amount", {
                currency: data?.currency ?? "",
              })}
              accessibilityLabel={t("firmSettings.sheet.amount", {
                currency: data?.currency ?? "",
              })}
              value={amount}
              onChangeText={edited(setAmount)}
              keyboardType="decimal-pad"
              maxLength={8}
              error={
                parseAmount(amount) === null
                  ? t("payRates.sheet.amountInvalid")
                  : undefined
              }
            />
          </View>
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
          <ThemedText
            variant="footnote"
            weight="regular"
            color="danger"
            className="ml-1"
          >
            {t("payRates.sheet.taken")}
          </ThemedText>
        ) : null}
      </View>
      {past ? (
        <Alert
          tone="danger"
          message={t("firmSettings.sheet.pastWarning", {
            date: format.shortDay(date),
          })}
        />
      ) : null}
      {failure === "offline" ? (
        <Alert tone="offline" message={t("fleet.saveOffline")} />
      ) : failure === "notEditable" ? (
        <Alert tone="danger" message={t("firmSettings.sheet.notEditable")} />
      ) : failure && failure !== "taken" ? (
        <Alert tone="danger" message={t("fleet.saveError")} />
      ) : null}
      <View className="gap-3">
        <Button
          title={t("fleet.save")}
          disabled={!valid || !changed}
          loading={saving}
          onPress={() => (past ? setConfirm("past") : write())}
        />
        {entry ? (
          <Button
            title={t("payRates.sheet.cancelChange")}
            variant="destructive"
            disabled={saving}
            onPress={() => setConfirm("cancel")}
          />
        ) : (
          <Button
            title={t("fleet.cancel")}
            variant="secondary"
            disabled={saving}
            onPress={() => router.back()}
          />
        )}
      </View>
      <ActionSheet
        visible={confirm !== null}
        title={
          confirm === "past"
            ? t("firmSettings.sheet.pastConfirmTitle", {
                date: format.shortDay(date),
              })
            : t("payRates.sheet.cancelConfirmTitle")
        }
        actions={
          confirm === "past"
            ? [
                {
                  label: t("firmSettings.sheet.pastConfirmAction"),
                  destructive: true,
                  onPress: write,
                },
              ]
            : [
                {
                  label: t("payRates.sheet.cancelConfirmAction"),
                  destructive: true,
                  onPress: () =>
                    entry && void run(() => actions.remove(entry.id)),
                },
              ]
        }
        cancelLabel={t("payRates.sheet.keep")}
        onClose={() => setConfirm(null)}
      />
    </FleetSheet>
  );
}
