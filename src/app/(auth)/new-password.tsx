import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { MIN_PASSWORD, useSignIn, type AuthError } from "@/auth";
import { Alert } from "@/components/alert";
import { authErrorKey } from "@/components/auth/auth-errors";
import { AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
import { useTranslation, type TranslationKey } from "@/i18n";

export default function NewPassword() {
  const { t } = useTranslation();
  const { signIn } = useSignIn();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<TranslationKey | undefined>();
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only reachable after a verified reset code.
  if (!signIn.resetVerified) return <Redirect href="/forgot-password" />;

  // Success signs the user in; the auth guard takes them home.
  async function submit() {
    setFormError(null);
    if (password.length < MIN_PASSWORD) {
      setFieldError("auth.errors.passwordShort");
      return;
    }
    setSubmitting(true);
    const { error, needsCode } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    setSubmitting(false);
    if (needsCode) router.replace({ pathname: "/verify", params: { flow: "sign-in" } });
    if (error?.field === "password") setFieldError(authErrorKey(error));
    else if (error) setFormError(error);
  }

  return (
    <AuthScreen title={t("auth.newPassword.title")} intro={t("auth.newPassword.intro")}>
      <View className="mt-6">
        <TextField
          label={t("auth.fields.newPassword.label")}
          accessibilityLabel={t("auth.fields.newPassword.label")}
          placeholder={t("auth.fields.newPassword.placeholder")}
          icon="lock"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setFieldError(undefined);
          }}
          error={fieldError && t(fieldError)}
          secureTextEntry
          secureToggleLabels={{ show: t("auth.showPassword"), hide: t("auth.hidePassword") }}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!submitting}
          autoFocus
        />
      </View>

      {formError ? (
        <Alert
          tone={formError.code === "network_error" ? "offline" : "danger"}
          message={t(authErrorKey(formError))}
          onDismiss={() => setFormError(null)}
          dismissLabel={t("auth.dismiss")}
          className="mt-6"
        />
      ) : null}

      <Button
        title={t("auth.newPassword.submit")}
        loading={submitting}
        onPress={submit}
        className="mt-6 mb-4"
      />
    </AuthScreen>
  );
}
