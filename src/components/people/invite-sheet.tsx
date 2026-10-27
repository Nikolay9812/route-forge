import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { FleetSheet, useSheetSave } from "@/components/fleet/sheet";
import { SegmentedControl } from "@/components/segmented-control";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { MAX_EMAIL, validEmail, type AssignableRole } from "@/domain/people";
import { useTranslation } from "@/i18n";
import { usePeopleActions } from "@/people/people";

// Invite someone by email as a courier, dispatcher or mechanic. Clerk sends the email; they accept it on the no-firm screen.
// A failure keeps what was typed.
export function InviteSheet() {
  const { t } = useTranslation();
  const actions = usePeopleActions();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("courier");
  const [touched, setTouched] = useState(false);
  const { saving, failure, run, clear } = useSheetSave();

  const valid = validEmail(email);
  const fieldError =
    failure === "exists"
      ? t("people.inviteSheet.exists")
      : failure === "invalid" || (touched && email.trim() !== "" && !valid)
        ? t("people.inviteSheet.invalid")
        : undefined;

  return (
    <FleetSheet title={t("people.inviteSheet.title")} body={t("people.inviteSheet.body")}>
      <TextField
        label={t("people.inviteSheet.email")}
        accessibilityLabel={t("people.inviteSheet.email")}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (failure) clear();
        }}
        onBlur={() => setTouched(true)}
        placeholder={t("people.inviteSheet.emailPlaceholder")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        autoFocus
        maxLength={MAX_EMAIL + 10}
        error={fieldError}
      />
      <View className="gap-2">
        <ThemedText variant="footnote" className="ml-1">
          {t("people.inviteSheet.role")}
        </ThemedText>
        <SegmentedControl<AssignableRole>
          options={[
            { value: "courier", label: t("people.roles.courier") },
            { value: "dispatcher", label: t("people.roles.dispatcher") },
            { value: "mechanic", label: t("people.roles.mechanic") },
          ]}
          value={role}
          onChange={setRole}
        />
      </View>
      {failure === "offline" ? (
        <Alert tone="offline" message={t("people.saveOffline")} />
      ) : failure === "memberLimit" ? (
        <Alert tone="danger" message={t("people.inviteSheet.memberLimit")} />
      ) : failure && failure !== "exists" && failure !== "invalid" ? (
        <Alert tone="danger" message={t("people.saveError")} />
      ) : null}
      <View className="gap-3">
        <Button
          title={t("people.inviteSheet.send")}
          disabled={!valid}
          loading={saving}
          onPress={() => valid && void run(() => actions.invite(valid, role))}
        />
        <Button title={t("people.cancel")} variant="secondary" disabled={saving} onPress={() => router.back()} />
      </View>
    </FleetSheet>
  );
}
