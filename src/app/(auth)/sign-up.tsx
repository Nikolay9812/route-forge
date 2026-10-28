import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { View, type TextInputInstance } from "react-native";

import { isEmail, MIN_PASSWORD, useSignUp, type AuthError } from "@/auth";
import { Alert } from "@/components/alert";
import { authErrorKey, type FieldErrors } from "@/components/auth/auth-errors";
import { AuthScreen } from "@/components/auth/auth-screen";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

type Field = "fullName" | "emailAddress" | "password";

export default function SignUp() {
  const { t } = useTranslation();
  const { signUp } = useSignUp();
  const [values, setValues] = useState<Record<Field, string>>({ fullName: "", emailAddress: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const change = (field: Field) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function submit() {
    const found: FieldErrors<Field> = {};
    if (!values.fullName.trim()) found.fullName = "auth.errors.nameRequired";
    if (!isEmail(values.emailAddress)) found.emailAddress = "auth.errors.emailInvalid";
    if (values.password.length < MIN_PASSWORD) found.password = "auth.errors.passwordShort";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const { error } = await signUp.password(values);
    if (!error) await signUp.verifications.sendEmailCode();
    setSubmitting(false);

    if (!error) router.push({ pathname: "/verify", params: { flow: "sign-up" } });
    else if (error.field && error.field !== "code") setErrors({ [error.field]: authErrorKey(error) });
    else setFormError(error);
  }

  return (
    <AuthScreen title={t("auth.signUp.title")} intro={t("auth.signUp.intro")}>
      <View className="mt-6 gap-3">
        <TextField
          label={t("auth.fields.fullName.label")}
          accessibilityLabel={t("auth.fields.fullName.label")}
          placeholder={t("auth.fields.fullName.placeholder")}
          icon="profile"
          value={values.fullName}
          onChangeText={change("fullName")}
          error={errors.fullName && t(errors.fullName)}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={emailRef}
          label={t("auth.fields.email.label")}
          accessibilityLabel={t("auth.fields.email.label")}
          placeholder={t("auth.fields.email.placeholder")}
          icon="mail"
          value={values.emailAddress}
          onChangeText={change("emailAddress")}
          error={errors.emailAddress && t(errors.emailAddress)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={passwordRef}
          label={t("auth.fields.password.label")}
          accessibilityLabel={t("auth.fields.password.label")}
          placeholder={t("auth.fields.password.placeholder")}
          icon="lock"
          value={values.password}
          onChangeText={change("password")}
          error={errors.password && t(errors.password)}
          secureTextEntry
          secureToggleLabels={{ show: t("auth.showPassword"), hide: t("auth.hidePassword") }}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
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
        title={t("auth.signUp.submit")}
        trailingIcon="arrow"
        loading={submitting}
        onPress={submit}
        className="mt-6"
      />
      <Divider label={t("auth.or")} className="mt-6" />
      <View className="mt-6">
        <GoogleButton disabled={submitting} onError={setFormError} />
      </View>
      <View className="mt-4 flex-row flex-wrap items-center justify-center gap-1">
        <ThemedText variant="caption" color="ink-muted">
          {t("auth.signUp.privacyIntro")}
        </ThemedText>
        <Link href="/privacy">
          <ThemedText variant="caption" weight="semibold" className="underline">
            {t("auth.signUp.privacyLink")}
          </ThemedText>
        </Link>
      </View>
      {/* Mount point for Clerk's bot protection when the instance turns captcha on. */}
      <View nativeID="clerk-captcha" />

      <View className="mt-auto flex-row items-center justify-center gap-1 pt-8 pb-4">
        <ThemedText variant="caption" color="ink-muted">
          {t("auth.signUp.haveAccount")}
        </ThemedText>
        <Link href="/sign-in" replace>
          <ThemedText variant="caption" weight="semibold" className="underline">
            {t("auth.signUp.signIn")}
          </ThemedText>
        </Link>
      </View>
    </AuthScreen>
  );
}
