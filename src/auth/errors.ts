import { isClerkAPIResponseError, isClerkRuntimeError } from "@clerk/expo";

export type AuthErrorCode =
  | "form_identifier_exists"
  | "form_identifier_not_found"
  | "form_password_incorrect"
  | "form_password_length_too_short"
  | "form_password_pwned"
  | "form_param_format_invalid"
  | "strategy_for_user_invalid"
  | "form_code_incorrect"
  | "verification_expired"
  | "too_many_attempts"
  | "network_error"
  | "unknown";

export type AuthField = "fullName" | "emailAddress" | "password" | "code";
export type AuthError = { code: AuthErrorCode; field?: AuthField };
export type AuthResult = { error: AuthError | null };

// The field each Clerk error belongs to; codes not listed show as a form alert.
const fieldFor: Partial<Record<AuthErrorCode, AuthField>> = {
  form_identifier_exists: "emailAddress",
  form_identifier_not_found: "emailAddress",
  form_password_incorrect: "password",
  form_password_length_too_short: "password",
  form_password_pwned: "password",
  strategy_for_user_invalid: "emailAddress",
  form_code_incorrect: "code",
  verification_expired: "code",
};

const fieldForParam: Record<string, AuthField> = {
  email_address: "emailAddress",
  identifier: "emailAddress",
  password: "password",
  first_name: "fullName",
  last_name: "fullName",
  code: "code",
};

const known = new Set<string>(Object.keys(fieldFor).concat("form_param_format_invalid"));

/** Turns anything Clerk returns or throws into a code the screens translate. Raw messages are dropped. */
export function toAuthError(error: unknown): AuthError {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0];
    const raw = first?.code ?? "";
    if (raw === "verification_failed" || raw === "too_many_requests" || error.status === 429) {
      return { code: "too_many_attempts" };
    }
    if (!known.has(raw)) return { code: "unknown" };
    const code = raw as AuthErrorCode;
    const param = typeof first?.meta?.paramName === "string" ? fieldForParam[first.meta.paramName] : undefined;
    return { code, field: fieldFor[code] ?? param };
  }
  if (isClerkRuntimeError(error) && error.code === "network_error") return { code: "network_error" };
  // React Native's fetch rejects with a TypeError "Network request failed" when offline.
  if (error instanceof TypeError && /network/i.test(error.message)) return { code: "network_error" };
  return { code: "unknown" };
}
