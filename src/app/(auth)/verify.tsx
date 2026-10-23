import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
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

type Flow = "sign-up" | "sign-in" | "reset";
const restart: Record<Flow, Href> = { "sign-up": "/sign-up", "sign-in": "/sign-in", reset: "/forgot-password" };

/**
 * Email code step for sign-up (`flow=sign-up`), a sign-in from a new device (`flow=sign-in`),
 * and password reset (`flow=reset`).
 */
export default function Verify() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ flow?: string }>();
  const flow: Flow = params.flow === "reset" || params.flow === "sign-in" ? params.flow : "sign-up";
  const { signUp } = useSignUp();
  const { signIn } = useSignIn();
  const reset = flow === "reset";
  const email = {
    "sign-up": signUp.emailAddress,
    "sign-in": signIn.trustEmailAddress,
    reset: signIn.resetEmailAddress,
  }[flow];

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

  // Opened without a pending attempt (deep link, finished flow): start that flow over.
  if (!email) return <Redirect href={restart[flow]} />;

  async function submit(value = code) {
    if (value.length < CODE_LENGTH || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await {
      "sign-up": () => signUp.verifications.verifyEmailCode({ code: value }),
      "sign-in": () => signIn.verifyEmailCode({ code: value }),
      reset: () => signIn.resetPasswordEmailCode.verifyCode({ code: value }),
    }[flow]();
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      setCode("");
    } else if (reset) {
      router.push("/new-password");
    }
    // A verified sign-up or new-device sign-in is signed in; the auth guard takes it home.
  }

  async function resend() {
    setError(null);
    setResent(false);
    setSecondsLeft(RESEND_SECONDS);
    const result = await {
      "sign-up": () => signUp.verifications.sendEmailCode(),
      "sign-in": () => signIn.sendEmailCode(),
      reset: () => signIn.resetPasswordEmailCode.sendCode({ emailAddress: email! }),
    }[flow]();
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
          error={error?.field === "code"}
          editable={!submitting}
          accessibilityLabel={t("auth.verify.codeLabel")}
        />
        {error?.field === "code" ? (
          <ThemedText variant="footnote" weight="regular" color="danger" className="ml-1">
            {t(authErrorKey(error))}
          </ThemedText>
        ) : null}
      </View>

      {error && error.field !== "code" ? (
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
