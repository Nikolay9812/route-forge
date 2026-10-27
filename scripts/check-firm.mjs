// Firm settings checks against a running dev server: only owners read and change them, seeded firms (with shifts)
// keep currency and timezone locked, rule entries change like pay rates (upcoming only, one per day), no firm
// reaches another's, and the SQL break on every shift equals breakFor() for the seeded law rule.
// Writes rule entries dated 2090 (removed with SQL at the end). Run with `npm run check:firm` (after db:seed).
import { LAW_DEFAULTS } from "../src/domain/firm.ts";
import { breakFor } from "../src/domain/salary.ts";

import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
};
const token = {
  a: await tokenFor(users.a, ivanov),
  b: await tokenFor(users.b, firmB),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
};

const cleanup = () => sql`delete from firm_rules where effective_from >= '2090-01-01'`;
await cleanup();
const rule = (effectiveFrom, extra = {}) => ({ effectiveFrom, ...LAW_DEFAULTS, ...extra });

try {
  // Owner: the seeded view.
  let r = await call(token.owner, "GET", "/api/firm");
  check("owner reads firm settings", r.status === 200 && r.json.name === "Ivanov Transport", r.status);
  check("seeded currency and timezone", r.json?.currency === "EUR" && r.json.timeZone === "Europe/Berlin");
  check("locked because the firm has shifts", r.json?.locked === true);
  check(
    "the law rule is current",
    r.json?.rule?.breakMinutes === 30 && r.json.rule.longBreakMinutes === 45 && r.json.rule.spesenMinor === 1400,
  );
  check("one seeded entry, current, named", r.json?.entries.length === 1 && r.json.entries[0].current && r.json.entries[0].setByName.length > 0);
  check("no upcoming rule yet", r.json?.next === null);
  const startedId = r.json?.entries[0]?.id;

  // Other roles and firms.
  for (const [who, t] of [["courier", token.a], ["dispatcher", token.dispatcher]]) {
    r = await call(t, "GET", "/api/firm");
    check(`${who} can't read firm settings`, r.status === 403 && r.json.error === "role", r.status);
    r = await call(t, "POST", "/api/firm/rules", rule("2090-01-01"));
    check(`${who} can't schedule a rule`, r.status === 403, r.status);
    r = await call(t, "PUT", "/api/firm/settings", { currency: "EUR", timeZone: "Europe/Berlin" });
    check(`${who} can't change settings`, r.status === 403, r.status);
  }

  // Currency and timezone stay locked.
  r = await call(token.owner, "PUT", "/api/firm/settings", { currency: "CHF", timeZone: "Europe/Zurich" });
  check("locked settings answer notEditable", r.status === 409 && r.json.error === "notEditable", r.status);
  r = await call(token.owner, "PUT", "/api/firm/settings", { currency: "BGN", timeZone: "Europe/Berlin" });
  check("currency off the list → 400", r.status === 400, r.status);

  // Schedule, collide, edit, cancel.
  r = await call(token.owner, "POST", "/api/firm/rules", rule("2090-01-01", { breakMinutes: 15 }));
  const upcoming = r.json?.entries?.find((e) => e.effectiveFrom === "2090-01-01");
  check("owner schedules a rule", r.status === 201 && upcoming?.upcoming && r.json.next?.breakMinutes === 15, r.status);
  check("the seeded rule is still current", r.json?.rule?.breakMinutes === 30);
  r = await call(token.owner, "POST", "/api/firm/rules", rule("2090-01-01"));
  check("a second rule on the same day is taken", r.status === 409 && r.json.error === "taken", r.status);
  r = await call(token.owner, "PATCH", `/api/firm/rules/${upcoming?.id}`, rule("2090-02-01", { spesenMinor: 0 }));
  check(
    "owner edits the upcoming rule whole",
    r.status === 200 && r.json.next?.effectiveFrom === "2090-02-01" && r.json.next.spesenMinor === 0 && r.json.next.breakMinutes === 30,
    r.status,
  );
  r = await call(token.owner, "PATCH", `/api/firm/rules/${startedId}`, rule("2090-03-01"));
  check("a started rule can't be edited", r.status === 409 && r.json.error === "notEditable", r.status);
  r = await call(token.owner, "DELETE", `/api/firm/rules/${startedId}`);
  check("a started rule can't be cancelled", r.status === 409 && r.json.error === "notEditable", r.status);

  // Firm B can't touch Ivanov's entry. Firm B has no owner (a token asked for a firm the user isn't in carries
  // their own firm instead), so its courier tries, and the row is checked in the database.
  r = await call(token.b, "GET", "/api/firm");
  check("Firm B courier can't read settings", r.status === 403, r.status);
  r = await call(token.b, "DELETE", `/api/firm/rules/${upcoming?.id}`);
  check("Firm B can't cancel Ivanov's rule", r.status === 403, r.status);
  const [kept] = await sql`select count(*)::int as n from firm_rules where id = ${upcoming?.id} and firm_id = ${ivanov}`;
  check("Ivanov's rule is still there", kept.n === 1);
  const [row] = await sql`select count(*)::int as n from firm_rules where firm_id = ${firmB} and effective_from >= '2090-01-01'`;
  check("nothing written to Firm B", row.n === 0);

  r = await call(token.owner, "DELETE", `/api/firm/rules/${upcoming?.id}`);
  check("owner cancels the upcoming rule", r.status === 200 && r.json.next === null && r.json.entries.length === 1, r.status);
  r = await call(token.owner, "DELETE", `/api/firm/rules/${upcoming?.id}`);
  check("a cancelled rule is gone", r.status === 404, r.status);

  // Input.
  const bad = [
    ["missing field", (({ spesenMinor: _s, ...rest }) => rest)(rule("2090-04-01"))],
    ["unknown key", { ...rule("2090-04-01"), note: "x" }],
    ["longer break starts first", rule("2090-04-01", { longBreakAfterMinutes: 300 })],
    ["longer break shorter", rule("2090-04-01", { longBreakMinutes: 15 })],
    ["fractional Spesen", rule("2090-04-01", { spesenMinor: 14.5 })],
    ["2090-02-30", rule("2090-02-30")],
  ];
  for (const [name, body] of bad) {
    r = await call(token.owner, "POST", "/api/firm/rules", body);
    check(`bad input → 400: ${name}`, r.status === 400, r.status);
  }
  r = await call(token.owner, "PATCH", "/api/firm/rules/not-a-uuid", rule("2090-04-01"));
  check("non-UUID id → 404", r.status === 404, r.status);

  // The SQL break equals breakFor() on every reviewed shift, and worked = shift time − break.
  const law = { effectiveFrom: "2000-01-01", ...LAW_DEFAULTS };
  r = await call(token.owner, "GET", "/api/approvals?view=reviewed");
  const items = r.json?.items ?? [];
  check(
    "server breaks match breakFor() on every reviewed shift",
    items.length > 0 &&
      items.every(
        ({ shift }) => shift.breakMinutes === breakFor(shift.minutes, law) && shift.workedMinutes === shift.minutes - shift.breakMinutes,
      ),
    `${items.length} shifts`,
  );
  check("seeded shifts cover both break lengths", new Set(items.map((i) => i.shift.breakMinutes)).size >= 2);
} finally {
  await cleanup();
}

finish("firm settings");
