// Input rules for the owner's People screen: invitations by email, and a member's role or dispatcher depots.
// Owners can only hand out courier, dispatcher and mechanic; the owner role stays in the Clerk dashboard.

export const MAX_EMAIL = 254;
/** More depots than any firm has; keeps a patch body small. */
export const MAX_DISPATCHER_DEPOTS = 100;

export const assignableRoles = ["courier", "dispatcher", "mechanic"] as const;
export type AssignableRole = (typeof assignableRoles)[number];

export type InviteInput = { email: string; role: AssignableRole };
export type PersonPatch = { role: AssignableRole } | { depotIds: string[] };

type Parsed<T> = { ok: true; value: T } | { ok: false };

/** A simple local@domain.tld shape; Clerk does the real check when it sends the email. */
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactly(body: Record<string, unknown>, keys: string[]): boolean {
  const present = Object.keys(body);
  return present.length === keys.length && keys.every((key) => key in body);
}

export function normalizeEmail(text: string): string {
  return text.trim().toLowerCase();
}

/** The normalised email, or null when it isn't one. */
export function validEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = normalizeEmail(value);
  return email.length <= MAX_EMAIL && EMAIL.test(email) ? email : null;
}

export function isAssignableRole(value: unknown): value is AssignableRole {
  return assignableRoles.includes(value as AssignableRole);
}

/** Body of "invite": exactly `{ email, role }`. */
export function parseInvite(body: unknown): Parsed<InviteInput> {
  if (!isObject(body) || !hasExactly(body, ["email", "role"])) return { ok: false };
  const email = validEmail(body.email);
  if (!email || !isAssignableRole(body.role)) return { ok: false };
  return { ok: true, value: { email, role: body.role } };
}

/** Body of a member change: exactly one of `{ role }` or `{ depotIds }` (distinct depot UUIDs, may be empty). */
export function parsePersonPatch(body: unknown): Parsed<PersonPatch> {
  if (!isObject(body)) return { ok: false };
  if (hasExactly(body, ["role"])) {
    return isAssignableRole(body.role) ? { ok: true, value: { role: body.role } } : { ok: false };
  }
  if (hasExactly(body, ["depotIds"])) {
    const ids = body.depotIds;
    if (!Array.isArray(ids) || ids.length > MAX_DISPATCHER_DEPOTS) return { ok: false };
    if (!ids.every((id) => typeof id === "string" && UUID.test(id))) return { ok: false };
    const lower = (ids as string[]).map((id) => id.toLowerCase());
    if (new Set(lower).size !== lower.length) return { ok: false };
    return { ok: true, value: { depotIds: lower } };
  }
  return { ok: false };
}
