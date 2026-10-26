import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { useSheetSave } from "@/components/fleet/sheet";
import { useFormat } from "@/components/home/format";
import { SegmentedControl } from "@/components/segmented-control";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import type { ApiFailure } from "@/api/client";
import { useSectionPhotos } from "@/documents/documents";
import {
  addDays,
  checkSection,
  formatIban,
  genders,
  LICENCE_CLASSES,
  sectionFields,
  taxClasses,
  type FieldProblem,
} from "@/domain/courier-details";
import type { CourierDetails, CourierDocuments, DetailsSection, Gender } from "@/domain/types";
import { useTranslation, type TranslationKey } from "@/i18n";

import { fieldHints, fieldKinds, sectionHints, sectionPhotos } from "./fields";
import { OptionalDateField } from "./optional-date-field";
import { PhotoSlot } from "./photo-slot";

type Field = keyof CourierDetails;
export type Values = Partial<Record<Field, string | string[] | number | null>>;

/** What the form shows for the stored values: text as typed ("" when unset), the IBAN in groups of 4. */
function initialValues(section: DetailsSection, details: CourierDetails): Values {
  const values: Values = {};
  for (const field of sectionFields[section]) {
    const kind = fieldKinds[field].kind;
    const stored = details[field];
    if (kind === "text") values[field] = field === "iban" && stored ? formatIban(stored as string) : ((stored as string) ?? "");
    else if (kind === "classes") values[field] = (stored as string[] | null) ?? [];
    else values[field] = stored as string | number | null;
  }
  return values;
}

// One section of a courier's documents: photos (the courier's own phone only), then its fields. Save sends the
// whole section; problems show under their fields once Save was tried, and a failed save keeps what was typed.
export function SectionForm({
  section,
  documents,
  withPhotos,
  save,
}: {
  section: DetailsSection;
  documents: CourierDocuments;
  /** Only on the courier's own phone; owners see no photo slots. */
  withPhotos: boolean;
  save: (section: DetailsSection, values: Values) => Promise<ApiFailure | null>;
}) {
  const { t } = useTranslation();
  // Calendar days formatted at UTC noon land on the same day everywhere.
  const format = useFormat("UTC", "EUR");
  const { photos, setPhoto } = useSectionPhotos(section);
  const [initial] = useState(() => initialValues(section, documents.details));
  const [values, setValues] = useState<Values>(initial);
  const [tried, setTried] = useState(false);
  const { saving, failure, run, clear } = useSheetSave();
  const { today } = documents;

  const check = checkSection(section, values, today);
  const problems = check && !check.ok ? check.problems : {};
  const changed = JSON.stringify(values) !== JSON.stringify(initial);
  const warning = documents.sections[section].warning;
  const slots = withPhotos ? (sectionPhotos[section] ?? []) : [];

  const set = (field: Field, value: Values[Field]) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    clear();
  };

  const submit = () => {
    setTried(true);
    if (!check?.ok) return;
    void run(() => save(section, values));
  };

  const errorOf = (field: Field): string | undefined => {
    const problem: FieldProblem | undefined = tried ? problems[field] : undefined;
    if (!problem) return undefined;
    if (problem !== "format") return t(`documents.errors.${problem}`);
    const key = fieldKinds[field].kind === "date" ? "date" : field;
    return t(`documents.errors.format.${key}` as TranslationKey);
  };

  const warningDate =
    section === "idCard" ? documents.details.idExpiresOn
    : section === "licence" ? documents.details.licenceExpiresOn
    : documents.details.criminalRecordIssuedOn;

  return (
    <>
      <Stack.Screen options={{ title: t(`documents.sections.${section}`) }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-4 px-4 pt-4 pb-8"
      >
        {warning && warningDate ? (
          <Alert tone="danger" message={t(`documents.warningBody.${warning}`, { date: format.fullDay(warningDate) })} />
        ) : null}
        {(sectionHints as readonly string[]).includes(section) ? (
          <ThemedText variant="footnote" className="ml-1">
            {t(`documents.hints.${section}` as TranslationKey)}
          </ThemedText>
        ) : null}
        {slots.length > 0 ? (
          <View className="gap-2">
            {/* Two slots per row; an odd last slot keeps the card size of a pair. */}
            {Array.from({ length: Math.ceil(slots.length / 2) }, (_, row) => slots.slice(row * 2, row * 2 + 2)).map(
              (pair) => (
                <View key={pair[0]} className="flex-row gap-3">
                  {pair.map((slot) => (
                    <PhotoSlot
                      key={slot}
                      label={t(`documents.photos.${slot}`)}
                      uri={photos[slot]}
                      onChange={(uri) => setPhoto(slot, uri)}
                    />
                  ))}
                  {pair.length === 1 ? <View className="flex-1" /> : null}
                </View>
              ),
            )}
            <ThemedText variant="footnote" className="ml-1">
              {t("documents.photos.notSaved")}
            </ThemedText>
          </View>
        ) : null}
        {sectionFields[section].map((field) => (
          <FieldInput
            key={field}
            field={field}
            value={values[field] ?? null}
            error={errorOf(field)}
            today={today}
            display={(day) => format.fullDay(day)}
            onChange={(value) => set(field, value)}
          />
        ))}
        {failure === "offline" ? (
          <Alert tone="offline" message={t("fleet.saveOffline")} />
        ) : failure ? (
          <Alert tone="danger" message={t("fleet.saveError")} />
        ) : tried && !check?.ok ? (
          <Alert tone="danger" message={t("documents.errors.check")} />
        ) : null}
        <Button title={t("fleet.save")} disabled={!changed} loading={saving} onPress={submit} />
      </ScrollView>
    </>
  );
}

function FieldInput({
  field,
  value,
  error,
  today,
  display,
  onChange,
}: {
  field: Field;
  value: string | string[] | number | null;
  error?: string;
  today: string;
  display: (day: string) => string;
  onChange: (value: string | string[] | number | null) => void;
}) {
  const { t } = useTranslation();
  const label = t(`documents.fields.${field}`);
  const kind = fieldKinds[field];

  switch (kind.kind) {
    case "text": {
      const hint = (fieldHints as readonly string[]).includes(field) ? t(`documents.hints.${field}` as TranslationKey) : null;
      return (
        <View className="gap-1">
          <TextField
            label={label}
            accessibilityLabel={label}
            value={value as string}
            onChangeText={onChange}
            keyboardType={kind.keyboard}
            autoCapitalize={kind.caps ?? "sentences"}
            autoCorrect={false}
            maxLength={kind.maxLength}
            error={error}
          />
          {hint && !error ? (
            <ThemedText variant="footnote" className="ml-1">
              {hint}
            </ThemedText>
          ) : null}
        </View>
      );
    }
    case "date": {
      const year = Number(today.slice(0, 4));
      const initial = kind.role === "birth" ? `${year - 30}-01-01` : kind.role === "expires" ? addDays(today, 1) : today;
      const day = value as string | null;
      return (
        <OptionalDateField
          label={label}
          value={day}
          display={day ? display(day) : ""}
          initial={initial}
          error={error}
          onChange={onChange}
        />
      );
    }
    case "gender":
      return (
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {label}
          </ThemedText>
          <SegmentedControl<Gender | "">
            options={genders.map((g) => ({ value: g, label: t(`documents.gender.${g}`) }))}
            value={(value as Gender | null) ?? ""}
            onChange={onChange}
          />
        </View>
      );
    case "taxClass":
      return (
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {label}
          </ThemedText>
          <SegmentedControl
            options={taxClasses.map((c) => ({ value: String(c), label: String(c) }))}
            value={value === null ? "" : String(value)}
            onChange={(next) => onChange(Number(next))}
          />
        </View>
      );
    case "classes": {
      const selected = value as string[];
      return (
        <View className="gap-2">
          <ThemedText variant="footnote" className="ml-1">
            {label}
          </ThemedText>
          <View className="flex-row flex-wrap gap-2">
            {LICENCE_CLASSES.map((c) => {
              const on = selected.includes(c);
              return (
                <Chip
                  key={c}
                  label={c}
                  selected={on}
                  onPress={() => onChange(on ? selected.filter((x) => x !== c) : [...selected, c])}
                />
              );
            })}
          </View>
        </View>
      );
    }
  }
}
