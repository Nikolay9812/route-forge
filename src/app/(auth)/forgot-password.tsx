import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { isEmail, useSignIn, type AuthError } from "@/auth";
import { Alert } from "@/components/alert";
import { authErrorKey } from "@/components/auth/auth-errors";
import { AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
import { useTranslation, type TranslationKey } from "@/i18n";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { signIn } = useSignIn();
  const [emailAddress, setEmailAddress] = useState("");
  const [fieldError, setFieldError] = useState<TranslationKey | undefined>();
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setFormError(null);
    if (!isEmail(emailAddress)) {
      setFieldError("auth.errors.emailInvalid");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn.resetPasswordEmailCode.sendCode({ emailAddress });
    setSubmitting(false);
    if (!error) router.push({ pathname: "/verify", params: { flow: "reset" } });
    else if (error.field === "emailAddress") setFieldError(authErrorKey(error));
    else setFormError(error);
  }

  return (
    <AuthScreen title={t("auth.forgot.title")} intro={t("auth.forgot.intro")}>
      <View className="mt-6">
        <TextField
          label={t("auth.fields.email.label")}
          accessibilityLabel={t("auth.fields.email.label")}
          placeholder={t("auth.fields.email.placeholder")}
          icon="mail"
          value={emailAddress}
          onChangeText={(text) => {
            setEmailAddress(text);
            setFieldError(undefined);
          }}
          error={fieldError && t(fieldError)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={submit}
          editable={!submitting}
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
        title={t("auth.forgot.submit")}
        trailingIcon="arrow"
        loading={submitting}
        onPress={submit}
        className="mt-6 mb-4"
      />
    </AuthScreen>
  );
}
