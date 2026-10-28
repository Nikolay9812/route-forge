// Adapts @clerk/expo's custom-flow API to the shape the auth screens use: every action resolves to
// { error } with a code from ./errors, and completed flows activate the session with finalize().
// Screens import auth only from here, never from @clerk/expo, and never show Clerk's raw messages.
import {
  useAuth as useClerkAuth,
  useSignIn as useClerkSignIn,
  useSignUp as useClerkSignUp,
  useSSO,
  useUser,
} from "@clerk/expo";

import { toAuthError, type AuthResult } from "./errors";

export type { AuthError, AuthErrorCode, AuthField, AuthResult } from "./errors";
export type User = { fullName: string; emailAddress: string };
/** `needsCode`: Clerk sent an email code (new-device check) that must be verified before the session starts. */
export type SignInResult = AuthResult & { needsCode?: boolean };

/** Matches the instance's minimum password length in Clerk (User & authentication → Password). */
export const MIN_PASSWORD = 8;

const ok: AuthResult = { error: null };
const unexpected: AuthResult = { error: { code: "unknown" } };

async function run(request: Promise<{ error: unknown }>): Promise<AuthResult> {
  try {
    const { error } = await request;
    return error ? { error: toAuthError(error) } : ok;
  } catch (error) {
    return { error: toAuthError(error) };
  }
}

/** "Maria Ivanova Petrova" → first "Maria", last "Ivanova Petrova". Clerk's fullName joins them back. */
function splitName(fullName: string) {
  const [firstName = "", ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(" ") : undefined };
}

export function useAuth() {
  const { isLoaded, isSignedIn, signOut } = useClerkAuth();
  const { user } = useUser();
  return {
    isLoaded,
    isSignedIn: isSignedIn === true,
    user: user
      ? ({ fullName: user.fullName ?? "", emailAddress: user.primaryEmailAddress?.emailAddress ?? "" } satisfies User)
      : null,
    signOut: () => signOut(),
  };
}

export function useSignUp() {
  const { signUp } = useClerkSignUp();
  const awaitingCode = signUp.status === "missing_requirements" && signUp.unverifiedFields.includes("email_address");

  return {
    signUp: {
      /** The email waiting for its code, or null when no sign-up is in progress. */
      emailAddress: awaitingCode ? signUp.emailAddress : null,
      password(params: { fullName: string; emailAddress: string; password: string }) {
        return run(
          signUp.password({
            emailAddress: params.emailAddress.trim(),
            password: params.password,
            ...splitName(params.fullName),
          }),
        );
      },
      verifications: {
        sendEmailCode: () => run(signUp.verifications.sendEmailCode()),
        async verifyEmailCode({ code }: { code: string }) {
          const verified = await run(signUp.verifications.verifyEmailCode({ code }));
          if (verified.error) return verified;
          // Every required field is collected up front, so a verified sign-up is complete.
          return signUp.status === "complete" ? run(signUp.finalize()) : unexpected;
        },
      },
    },
  };
}

export function useSignIn() {
  const { signIn } = useClerkSignIn();
  const { startSSOFlow } = useSSO();
  const resetting = signIn.firstFactorVerification.strategy === "reset_password_email_code";

  // After a first factor: start the session, or send the new-device code Clerk asks for.
  async function continueSignIn(): Promise<SignInResult> {
    if (signIn.status === "complete") return run(signIn.finalize());
    if (signIn.status === "needs_client_trust" && signIn.supportedSecondFactors.some((f) => f.strategy === "email_code")) {
      const sent = await run(signIn.mfa.sendEmailCode());
      return sent.error ? sent : { error: null, needsCode: true };
    }
    // MFA and Protect checks are off for this instance.
    return unexpected;
  }

  return {
    signIn: {
      /** The email waiting for a new-device code, or null. */
      trustEmailAddress: signIn.status === "needs_client_trust" ? signIn.identifier : null,
      /** The email waiting for a reset code, or null. */
      resetEmailAddress: resetting && signIn.status === "needs_first_factor" ? signIn.identifier : null,
      resetVerified: signIn.status === "needs_new_password",

      async password(params: { emailAddress: string; password: string }): Promise<SignInResult> {
        const result = await run(signIn.password({ emailAddress: params.emailAddress.trim(), password: params.password }));
        return result.error ? result : continueSignIn();
      },
      sendEmailCode: () => run(signIn.mfa.sendEmailCode()),
      async verifyEmailCode({ code }: { code: string }) {
        const verified = await run(signIn.mfa.verifyEmailCode({ code }));
        if (verified.error) return verified;
        return signIn.status === "complete" ? run(signIn.finalize()) : unexpected;
      },

      // SSO is the one flow that still activates with setActive. A closed browser returns no session.
      async sso(_params: { strategy: "oauth_google" }): Promise<AuthResult> {
        try {
          const { createdSessionId, setActive } = await startSSOFlow({ strategy: "oauth_google" });
          if (createdSessionId && setActive) await setActive({ session: createdSessionId });
          return ok;
        } catch (error) {
          return { error: toAuthError(error) };
        }
      },

      resetPasswordEmailCode: {
        async sendCode({ emailAddress }: { emailAddress: string }) {
          const created = await run(signIn.create({ identifier: emailAddress.trim() }));
          return created.error ? created : run(signIn.resetPasswordEmailCode.sendCode());
        },
        verifyCode: ({ code }: { code: string }) => run(signIn.resetPasswordEmailCode.verifyCode({ code })),
        // Clerk signs the user in once the new password is set.
        async submitPassword({ password }: { password: string }): Promise<SignInResult> {
          const result = await run(signIn.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true }));
          return result.error ? result : continueSignIn();
        },
      },
    },
  };
}

/** Client-side check before calling the API; Clerk validates again. */
export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export {
  FirmProvider,
  isReviewer,
  useFirm,
  useFirmId,
  useSessionToken,
  type FirmInvitation,
  type FirmRole,
  type FirmState,
} from "./firm";
