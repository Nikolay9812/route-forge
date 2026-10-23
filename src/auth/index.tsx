// MOCK auth. The Clerk plan replaces this file with @clerk/expo, keeping the same hook shapes:
// every action resolves to { error } like Clerk's custom-flow API, and screens translate error codes.
// Nothing here is secure or persisted: accounts and the session live in memory until reload.
import { createContext, use, useState, type PropsWithChildren } from "react";

export type AuthErrorCode =
  | "form_identifier_exists"
  | "form_identifier_not_found"
  | "form_password_incorrect"
  | "form_password_length_too_short"
  | "form_code_incorrect"
  | "network_error";

export type AuthField = "fullName" | "emailAddress" | "password" | "code";
export type AuthError = { code: AuthErrorCode; field?: AuthField };
export type AuthResult = { error: AuthError | null };
export type User = { fullName: string; emailAddress: string };

type Account = User & { password: string };

/** The code every mock email "contains" (Clerk's test code). */
export const MOCK_CODE = "424242";
const MIN_PASSWORD = 8;
const DEMO: Account = { fullName: "Demo Courier", emailAddress: "courier@example.com", password: "password123" };

const delay = () => new Promise((resolve) => setTimeout(resolve, 700));
const fail = (code: AuthErrorCode, field?: AuthField): AuthResult => ({ error: { code, field } });
const ok: AuthResult = { error: null };
const normalize = (email: string) => email.trim().toLowerCase();
// Lets testers see the offline state without turning the network off.
const isOffline = (email: string) => normalize(email).endsWith("@offline.test");

type AuthContextValue = {
  user: User | null;
  signOut: () => void;
  signUp: ReturnType<typeof useSignUpState>;
  signIn: ReturnType<typeof useSignInState>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuthContext() {
  const value = use(AuthContext);
  if (!value) throw new Error("Auth hooks need <AuthProvider>.");
  return value;
}

function useSignUpState(accounts: Map<string, Account>, setUser: (user: User) => void) {
  const [pending, setPending] = useState<Account | null>(null);
  // Like Clerk's signUp object, the attempt stays readable after it completes, until clear().
  return {
    clear: () => setPending(null),
    emailAddress: pending?.emailAddress ?? null,
    async password(params: { fullName: string; emailAddress: string; password: string }): Promise<AuthResult> {
      await delay();
      const emailAddress = normalize(params.emailAddress);
      if (isOffline(emailAddress)) return fail("network_error");
      if (accounts.has(emailAddress)) return fail("form_identifier_exists", "emailAddress");
      if (params.password.length < MIN_PASSWORD) return fail("form_password_length_too_short", "password");
      setPending({ fullName: params.fullName.trim(), emailAddress, password: params.password });
      return ok;
    },
    verifications: {
      async sendEmailCode(): Promise<AuthResult> {
        await delay();
        return ok;
      },
      // Clerk verifies, then finalize() activates the session; the mock does both here.
      async verifyEmailCode({ code }: { code: string }): Promise<AuthResult> {
        await delay();
        if (!pending) return fail("form_identifier_not_found");
        if (code !== MOCK_CODE) return fail("form_code_incorrect", "code");
        accounts.set(pending.emailAddress, pending);
        setUser({ fullName: pending.fullName, emailAddress: pending.emailAddress });
        return ok;
      },
    },
  };
}

function useSignInState(accounts: Map<string, Account>, setUser: (user: User) => void) {
  const [reset, setReset] = useState<{ emailAddress: string; verified: boolean } | null>(null);
  return {
    clear: () => setReset(null),
    resetEmailAddress: reset?.emailAddress ?? null,
    resetVerified: reset?.verified ?? false,
    async password(params: { emailAddress: string; password: string }): Promise<AuthResult> {
      await delay();
      const emailAddress = normalize(params.emailAddress);
      if (isOffline(emailAddress)) return fail("network_error");
      const account = accounts.get(emailAddress);
      if (!account) return fail("form_identifier_not_found", "emailAddress");
      if (account.password !== params.password) return fail("form_password_incorrect", "password");
      setUser({ fullName: account.fullName, emailAddress });
      return ok;
    },
    async sso(_params: { strategy: "oauth_google" }): Promise<AuthResult> {
      await delay();
      setUser({ fullName: DEMO.fullName, emailAddress: DEMO.emailAddress });
      return ok;
    },
    resetPasswordEmailCode: {
      async sendCode(params: { emailAddress: string }): Promise<AuthResult> {
        await delay();
        const emailAddress = normalize(params.emailAddress);
        if (isOffline(emailAddress)) return fail("network_error");
        if (!accounts.has(emailAddress)) return fail("form_identifier_not_found", "emailAddress");
        setReset({ emailAddress, verified: false });
        return ok;
      },
      async verifyCode({ code }: { code: string }): Promise<AuthResult> {
        await delay();
        if (!reset) return fail("form_identifier_not_found");
        if (code !== MOCK_CODE) return fail("form_code_incorrect", "code");
        setReset({ ...reset, verified: true });
        return ok;
      },
      // Clerk signs the user in once the new password is set.
      async submitPassword({ password }: { password: string }): Promise<AuthResult> {
        await delay();
        const account = reset?.verified ? accounts.get(reset.emailAddress) : undefined;
        if (!account) return fail("form_identifier_not_found");
        if (password.length < MIN_PASSWORD) return fail("form_password_length_too_short", "password");
        accounts.set(account.emailAddress, { ...account, password });
        setUser({ fullName: account.fullName, emailAddress: account.emailAddress });
        return ok;
      },
    },
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  // One mutable map for the provider's lifetime; changes to it never need a re-render.
  const [accounts] = useState(() => new Map<string, Account>([[DEMO.emailAddress, DEMO]]));
  const [user, setUser] = useState<User | null>(null);
  const signUp = useSignUpState(accounts, setUser);
  const signIn = useSignInState(accounts, setUser);
  const signOut = () => {
    signUp.clear();
    signIn.clear();
    setUser(null);
  };
  return <AuthContext value={{ user, signOut, signUp, signIn }}>{children}</AuthContext>;
}

export function useAuth() {
  const { user, signOut } = useAuthContext();
  return { isSignedIn: user !== null, user, signOut };
}

export function useSignUp() {
  return { signUp: useAuthContext().signUp };
}

export function useSignIn() {
  return { signIn: useAuthContext().signIn };
}

/** Client-side check before calling the API; the server (Clerk) validates again. */
export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export { MIN_PASSWORD };
