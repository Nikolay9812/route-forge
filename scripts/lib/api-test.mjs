// Shared helpers for the API check scripts: Clerk Backend API lookups, short-lived session tokens for the
// `+clerk_test` users, calls to the running dev server, and a pass/fail tally. Dev branch only.
import { neon } from "@neondatabase/serverless";

const { CLERK_SECRET_KEY, DATABASE_URL, NEON_BRANCH, API_BASE = "http://localhost:8081" } = process.env;
if (!CLERK_SECRET_KEY || !DATABASE_URL) throw new Error("CLERK_SECRET_KEY and DATABASE_URL must be set (.env.local).");
if (NEON_BRANCH !== "dev") throw new Error("The API checks delete test shifts: run them only against the Neon dev branch.");

export const sql = neon(DATABASE_URL);

async function clerk(path, body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Clerk ${path}: ${res.status}`);
  return res.json();
}

export async function userByEmail(email) {
  const [user] = await clerk(`/users?email_address=${encodeURIComponent(email)}`);
  if (!user) throw new Error(`No Clerk user ${email}. Create the test users first.`);
  return user.id;
}

export async function orgByName(name) {
  const { data } = await clerk(`/organizations?query=${encodeURIComponent(name)}`);
  const org = data.find((o) => o.name === name);
  if (!org) throw new Error(`No Clerk organization "${name}".`);
  return org.id;
}

/** A fresh session token (valid ~60 s) for the user with the firm active. */
export async function tokenFor(userId, orgId) {
  const session = await clerk("/sessions", { user_id: userId });
  const { jwt } = await clerk(`/sessions/${session.id}/tokens`, { organization_id: orgId });
  return jwt;
}

export async function call(token, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

let failures = 0;

export function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? ` (${detail})` : ""}`);
}

export function finish(label) {
  console.log(failures ? `\n${failures} check(s) failed.` : `\nAll ${label} checks passed.`);
  process.exitCode = failures ? 1 : 0;
}
