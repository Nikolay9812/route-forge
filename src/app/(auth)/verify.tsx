import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { useSignIn, useSignUp, type AuthError } from "@/auth";
import { Alert } from "@/components/alert";
import { authErrorKey } from "@/components/auth/auth-errors";
import { AuthScreen } from "@/components/auth/auth-screen";
import { CODE_LENGTH, CodeInput } from "@/components/auth/code-input";
import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

const RESEND_SECONDS = 30;

/** Email code step for both sign-up (`flow=sign-up`) and password reset (`flow=reset`). */
export default function Verify() {
  const { t } = useTranslation();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const { signUp } = useSignUp();
  const { signIn } = useSignIn();
  const reset = flow === "reset";
  const email = reset ? signIn.resetEmailAddress : signUp.emailAddress;

  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Opened without a pending sign-up or reset (deep link, reload): start over.
  if (!email) return <Redirect href={reset ? "/forgot-password" : "/sign-up"} />;

  async function submit(value = code) {
    if (value.length < CODE_LENGTH || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = reset
      ? await signIn.resetPasswordEmailCode.verifyCode({ code: value })
      : await signUp.verifications.verifyEmailCode({ code: value });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      setCode("");
    } else if (reset) {
      router.push("/new-password");
    }
    // A verified sign-up is signed in; the auth guard takes it home.
  }

  async function resend() {
    setError(null);
    setResent(false);
    setSecondsLeft(RESEND_SECONDS);
    const result = reset
      ? await signIn.resetPasswordEmailCode.sendCode({ emailAddress: email! })
      : await signUp.verifications.sendEmailCode();
    if (result.error) setError(result.error);
    else setResent(true);
  }

  const time = `0:${String(secondsLeft).padStart(2, "0")}`;

  return (
    <AuthScreen title={t("auth.verify.title")} intro={t("auth.verify.intro", { email })}>
      <View className="mt-6 gap-1.5">
        <CodeInput
          value={code}
          onChangeText={(next) => {
            setCode(next);
            setError(null);
            if (next.length === CODE_LENGTH) submit(next);
          }}
          error={error?.code === "form_code_incorrect"}
          editable={!submitting}
          accessibilityLabel={t("auth.verify.codeLabel")}
        />
        {error?.code === "form_code_incorrect" ? (
          <ThemedText variant="footnote" weight="regular" color="danger" className="ml-1">
            {t(authErrorKey(error))}
          </ThemedText>
        ) : null}
      </View>

      {error && error.code !== "form_code_incorrect" ? (
        <Alert
          tone={error.code === "network_error" ? "offline" : "danger"}
          message={t(authErrorKey(error))}
          onDismiss={() => setError(null)}
          dismissLabel={t("auth.dismiss")}
          className="mt-6"
        />
      ) : null}
      {resent ? (
        <Alert
          tone="success"
          message={t("auth.verify.resent")}
          onDismiss={() => setResent(false)}
          dismissLabel={t("auth.dismiss")}
          className="mt-6"
        />
      ) : null}

      <Button
        title={t("auth.verify.submit")}
        loading={submitting}
        disabled={code.length < CODE_LENGTH}
        onPress={() => submit()}
        className="mt-6"
      />

      <View className="mt-6 flex-row items-center justify-center gap-1 pb-4">
        <ThemedText variant="caption" color="ink-muted">
          {t("auth.verify.noCode")}
        </ThemedText>
        {secondsLeft > 0 ? (
          <ThemedText variant="caption" color="ink-muted">
            {t("auth.verify.resendIn", { time })}
          </ThemedText>
        ) : (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={resend}>
            <ThemedText variant="caption" weight="semibold" className="underline">
              {t("auth.verify.resend")}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </AuthScreen>
  );
}
