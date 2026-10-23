import { Link } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, View, type TextInputInstance } from "react-native";

import { isEmail, useSignIn, type AuthError } from "@/auth";
import { Alert } from "@/components/alert";
import { authErrorKey, type FieldErrors } from "@/components/auth/auth-errors";
import { AuthScreen } from "@/components/auth/auth-screen";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

type Field = "emailAddress" | "password";

export default function SignIn() {
  const { t } = useTranslation();
  const { signIn } = useSignIn();
  const [values, setValues] = useState<Record<Field, string>>({ emailAddress: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const change = (field: Field) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // Success flips the auth guard, which takes the user home.
  async function submit() {
    const found: FieldErrors<Field> = {};
    if (!isEmail(values.emailAddress)) found.emailAddress = "auth.errors.emailInvalid";
    if (!values.password) found.password = "auth.errors.passwordRequired";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const { error } = await signIn.password(values);
    setSubmitting(false);
    if (!error) return;
    if (error.field === "emailAddress" || error.field === "password") setErrors({ [error.field]: authErrorKey(error) });
    else setFormError(error);
  }

  return (
    <AuthScreen title={t("auth.signIn.title")} intro={t("auth.signIn.intro")}>
      <View className="mt-6 gap-3">
        <TextField
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
          label={t("auth.fields.currentPassword.label")}
          accessibilityLabel={t("auth.fields.currentPassword.label")}
          placeholder={t("auth.fields.currentPassword.placeholder")}
          icon="lock"
          value={values.password}
          onChangeText={change("password")}
          error={errors.password && t(errors.password)}
          secureTextEntry
          secureToggleLabels={{ show: t("auth.showPassword"), hide: t("auth.hidePassword") }}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!submitting}
        />
      </View>
      <View className="mt-3 items-end">
        <Link href="/forgot-password" asChild>
          <Pressable accessibilityRole="link" hitSlop={8}>
            <ThemedText variant="caption" weight="semibold" color="secondary-ink">
              {t("auth.signIn.forgot")}
            </ThemedText>
          </Pressable>
        </Link>
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
        title={t("auth.signIn.submit")}
        trailingIcon="arrow"
        loading={submitting}
        onPress={submit}
        className="mt-6"
      />
      <Divider label={t("auth.or")} className="mt-6" />
      <View className="mt-6">
        <GoogleButton disabled={submitting} onError={setFormError} />
      </View>

      <View className="mt-auto flex-row items-center justify-center gap-1 pt-8 pb-4">
        <ThemedText variant="caption" color="ink-muted">
          {t("auth.signIn.noAccount")}
        </ThemedText>
        <Link href="/sign-up" replace>
          <ThemedText variant="caption" weight="semibold" className="underline">
            {t("auth.signIn.signUp")}
          </ThemedText>
        </Link>
      </View>
    </AuthScreen>
  );
}
