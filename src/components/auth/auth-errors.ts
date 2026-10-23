import type { AuthError, AuthErrorCode } from "@/auth";
import type { TranslationKey } from "@/i18n";

// Screens show translated text for each error code, never the provider's raw message.
const messages: Record<AuthErrorCode, TranslationKey> = {
  form_identifier_exists: "auth.errors.emailExists",
  form_identifier_not_found: "auth.errors.emailNotFound",
  form_password_incorrect: "auth.errors.passwordIncorrect",
  form_password_length_too_short: "auth.errors.passwordShort",
  form_password_pwned: "auth.errors.passwordPwned",
  form_param_format_invalid: "auth.errors.emailInvalid",
  strategy_for_user_invalid: "auth.errors.useGoogle",
  form_code_incorrect: "auth.errors.codeIncorrect",
  verification_expired: "auth.errors.codeExpired",
  too_many_attempts: "auth.errors.tooManyAttempts",
  network_error: "auth.errors.network",
  unknown: "auth.errors.unknown",
};

export function authErrorKey(error: AuthError): TranslationKey {
  return messages[error.code] ?? "auth.errors.unknown";
}

/** Errors tied to a field show under it; the rest (network, unknown) show as a form alert. */
export type FieldErrors<F extends string> = Partial<Record<F, TranslationKey>>;
