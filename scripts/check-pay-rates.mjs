// Pay-rate checks against a running dev server: only owners see and set rates, the firm default and courier
// overrides resolve per day, only upcoming entries change, backdating reaches approved pay, and no firm reaches
// another's rates. Writes entries dated 2090 (and one backdated entry), all removed with SQL at the end.
// Run with `npm run check:pay-rates` (after db:seed). Amounts are compared, never printed.
import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  c: await userByEmail("courier.c+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
};
const token = {
  a: await tokenFor(users.a, ivanov),
  b: await tokenFor(users.b, firmB),
  c: await tokenFor(users.c, ivanov),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
};

const cleanup = () => sql`delete from pay_rates where firm_id = ${ivanov} and effective_from >= '2090-01-01'`;
await cleanup();
let backdatedId = null;

try {
  // Owner: list, with the seeded resolution.
  let r = await call(token.owner, "GET", "/api/pay-rates");
  const today = r.json?.today ?? "";
  const day = Number(today.slice(8, 10));
  const seededHourly = day >= 15 ? 1600 : 1500;
  check("owner lists pay rates", r.status === 200 && r.json.couriers.length >= 2, r.status);
  const firmCurrent = r.json.firmDefault.current;
  check("firm default is the seeded hourly rate", firmCurrent?.kind === "hourly" && firmCurrent.amountMinor === seededHourly);
  const courier = (list, id) => list.couriers.find((x) => x.userId === id);
  const a = courier(r.json, users.a);
  const c = courier(r.json, users.c);
  check("courier.a follows the firm default", a?.followsFirm === true && a.current?.amountMinor === seededHourly);
  check("courier.c is on the 130.00 day rate", c?.followsFirm === false && c.current?.kind === "daily" && c.current.amountMinor === 13000);
  check("courier.c's seeded entry is current, not upcoming", c?.entries.length === 1 && c.entries[0].current && !c.entries[0].upcoming);
  check("no Firm B courier in the list", !courier(r.json, users.b));
  check("entries name who set them", r.json.firmDefault.entries.every((e) => e.setByName.length > 0));
  const startedFirmEntry = r.json.firmDefault.entries.find((e) => e.current);

  // Firm default: schedule, duplicate day.
  r = await call(token.owner, "POST", "/api/pay-rates", { userId: null, effectiveFrom: "2090-01-01", kind: "hourly", amountMinor: 1700 });
  check("owner schedules a firm default change", r.status === 201 && r.json.next?.effectiveFrom === "2090-01-01" && r.json.next.amountMinor === 1700, r.status);
  check("the new entry is upcoming", r.json?.entries.find((e) => e.effectiveFrom === "2090-01-01")?.upcoming === true);
  r = await call(token.owner, "POST", "/api/pay-rates", { userId: null, effectiveFrom: "2090-01-01", kind: "daily", amountMinor: 9000 });
  check("a second firm default entry on the same day is taken", r.status === 409 && r.json.error === "taken", r.status);

  // courier.a: schedule, edit, collide, switch to "firm", cancel.
  r = await call(token.owner, "POST", "/api/pay-rates", { userId: users.a, effectiveFrom: "2090-02-01", kind: "daily", amountMinor: 12000 });
  const entryA = r.json?.entries.find((e) => e.effectiveFrom === "2090-02-01");
  check("owner schedules a courier override", r.status === 201 && entryA?.upcoming && entryA.kind === "daily", r.status);
  // The firm's 2090-01-01 change still comes first for a courier following the default.
  check("next change is the earlier firm default one", r.json?.next?.effectiveFrom === "2090-01-01" && r.json.followsFirm === true);
  r = await call(token.owner, "PATCH", `/api/pay-rates/${entryA?.id}`, { amountMinor: 12500, effectiveFrom: "2090-02-02" });
  const editedA = r.json?.entries.find((e) => e.id === entryA?.id);
  check("owner edits an upcoming entry", r.status === 200 && editedA?.amountMinor === 12500 && editedA.effectiveFrom === "2090-02-02", r.status);
  r = await call(token.owner, "POST", "/api/pay-rates", { userId: users.a, effectiveFrom: "2090-03-01", kind: "hourly", amountMinor: 1800 });
  const laterA = r.json?.entries.find((e) => e.effectiveFrom === "2090-03-01");
  r = await call(token.owner, "PATCH", `/api/pay-rates/${entryA?.id}`, { effectiveFrom: "2090-03-01" });
  check("moving an entry onto another entry's day is taken", r.status === 409 && r.json.error === "taken", r.status);
  r = await call(token.owner, "PATCH", `/api/pay-rates/${entryA?.id}`, { kind: "firm" });
  const firmA = r.json?.entries.find((e) => e.id === entryA?.id);
  check("switching to follow the firm drops the amount", r.status === 200 && firmA?.kind === "firm" && firmA.amountMinor === null, r.status);
  r = await call(token.owner, "DELETE", `/api/pay-rates/${entryA?.id}`);
  check("owner cancels an upcoming entry", r.status === 200 && !r.json.entries.some((e) => e.id === entryA?.id), r.status);
  r = await call(token.owner, "DELETE", `/api/pay-rates/${laterA?.id}`);
  check("cancelled the second one too", r.status === 200, r.status);

  // courier.c: back to the firm default from a future day.
  r = await call(token.owner, "POST", "/api/pay-rates", { userId: users.c, effectiveFrom: "2090-01-05", kind: "firm" });
  check("owner schedules 'follow firm default' for a courier", r.status === 201 && r.json.next?.kind === "hourly" && r.json.next.effectiveFrom === "2090-01-05", r.status);

  // Started entries are history.
  r = await call(token.owner, "PATCH", `/api/pay-rates/${startedFirmEntry?.id}`, { amountMinor: 100 });
  check("a started entry can't be edited", r.status === 409 && r.json.error === "notEditable", r.status);
  r = await call(token.owner, "DELETE", `/api/pay-rates/${startedFirmEntry?.id}`);
  check("a started entry can't be cancelled", r.status === 409 && r.json.error === "notEditable", r.status);

  // Day-rate pay in review detail and Home.
  const [shiftC] = await sql`
    select id, to_char(date, 'YYYY-MM-DD') as date, minutes from shifts
    where firm_id = ${ivanov} and user_id = ${users.c} and status = 'approved' and date >= ${`${today.slice(0, 7)}-02`}
    order by date desc limit 1`;
  check("courier.c has an approved shift this month (seed)", Boolean(shiftC));
  r = await call(token.owner, "GET", `/api/approvals/${shiftC?.id}`);
  check("review pay for a day-rate shift is the day rate", r.json?.pay?.kind === "daily" && r.json.pay.payMinor === 13000, r.status);
  r = await call(token.c, "GET", "/api/home");
  const homeBefore = r.json?.totals.payMinor;
  check("courier.c's Home shows their own day rate", r.json?.rate.current?.kind === "daily" && r.json.rate.current.amountMinor === 13000);

  // Backdating: hourly 20.00 from that shift's day reaches its approved pay and the month total.
  r = await call(token.owner, "POST", "/api/pay-rates", { userId: users.c, effectiveFrom: shiftC?.date, kind: "hourly", amountMinor: 2000 });
  check("owner may backdate an entry", r.status === 201 && r.json.current?.kind === "hourly", r.status);
  backdatedId = r.json?.entries.find((e) => e.effectiveFrom === shiftC?.date)?.id ?? null;
  r = await call(token.owner, "GET", `/api/approvals/${shiftC?.id}`);
  check("backdated rate reaches the approved shift's pay", r.json?.pay?.kind === "hourly" && r.json.pay.payMinor === Math.round((shiftC.minutes * 2000) / 60));
  r = await call(token.c, "GET", "/api/home");
  check("backdated rate changes the month total", r.json?.totals.payMinor !== homeBefore);
  await sql`delete from pay_rates where id = ${backdatedId}`;
  backdatedId = null;
  r = await call(token.c, "GET", "/api/home");
  check("removing it restores the month total", r.json?.totals.payMinor === homeBefore);

  // courier.a's Home: own rate only, with the scheduled firm change.
  r = await call(token.a, "GET", "/api/home");
  check("courier.a's Home rate follows the firm default", r.json?.rate.current?.amountMinor === seededHourly);
  check("courier.a sees the upcoming firm change", r.json?.rate.next?.effectiveFrom === "2090-01-01" && r.json.rate.next.amountMinor === 1700);
  check("Home rate carries only current and next", Object.keys(r.json?.rate ?? {}).sort().join() === "current,next");

  // Roles: every pay-rate route is owner-only.
  for (const [who, t] of [["dispatcher", token.dispatcher], ["courier.a", token.a], ["courier.b (Firm B)", token.b]]) {
    const results = [
      await call(t, "GET", "/api/pay-rates"),
      await call(t, "POST", "/api/pay-rates", { userId: null, effectiveFrom: "2090-04-01", kind: "hourly", amountMinor: 1 }),
      await call(t, "PATCH", `/api/pay-rates/${startedFirmEntry?.id}`, { amountMinor: 1 }),
      await call(t, "DELETE", `/api/pay-rates/${startedFirmEntry?.id}`),
    ];
    check(`${who} gets 403 role on every route`, results.every((x) => x.status === 403 && x.json.error === "role"), results.map((x) => x.status).join());
  }

  // Tenant isolation.
  const [rateB] = await sql`select id, amount_minor, to_char(effective_from, 'YYYY-MM-DD') as effective_from from pay_rates where firm_id = ${firmB} limit 1`;
  r = await call(token.owner, "PATCH", `/api/pay-rates/${rateB.id}`, { amountMinor: 1 });
  check("another firm's entry → 404 on PATCH", r.status === 404, r.status);
  r = await call(token.owner, "DELETE", `/api/pay-rates/${rateB.id}`);
  check("another firm's entry → 404 on DELETE", r.status === 404, r.status);
  const [afterB] = await sql`select amount_minor, to_char(effective_from, 'YYYY-MM-DD') as effective_from from pay_rates where id = ${rateB.id}`;
  check("Firm B's entry is unchanged", afterB?.amount_minor === rateB.amount_minor && afterB.effective_from === rateB.effective_from);
  r = await call(token.owner, "POST", "/api/pay-rates", { userId: users.b, effectiveFrom: "2090-05-01", kind: "hourly", amountMinor: 1000 });
  check("a Firm B courier can't get an Ivanov rate", r.status === 400, r.status);

  // Bad input.
  const base = { userId: null, effectiveFrom: "2090-06-01", kind: "hourly" };
  const bad = [
    ["amount 0", { ...base, amountMinor: 0 }],
    ["negative amount", { ...base, amountMinor: -5 }],
    ["amount above 1000.00", { ...base, amountMinor: 100001 }],
    ["fractional minor units", { ...base, amountMinor: 12.5 }],
    ["missing amount", base],
    ["'firm' for the firm default", { ...base, kind: "firm" }],
    ["'firm' with an amount", { ...base, userId: users.a, kind: "firm", amountMinor: 100 }],
    ["2026-02-30", { ...base, effectiveFrom: "2026-02-30", amountMinor: 100 }],
    ["unknown kind", { ...base, kind: "weekly", amountMinor: 100 }],
    ["unknown key", { ...base, amountMinor: 100, note: "x" }],
  ];
  for (const [name, body] of bad) {
    r = await call(token.owner, "POST", "/api/pay-rates", body);
    check(`bad input → 400: ${name}`, r.status === 400, r.status);
  }
  r = await call(token.owner, "PATCH", `/api/pay-rates/${startedFirmEntry?.id}`, {});
  check("empty patch → 400", r.status === 400, r.status);
  r = await call(token.owner, "PATCH", "/api/pay-rates/not-a-uuid", { amountMinor: 100 });
  check("non-UUID id → 404", r.status === 404, r.status);
} finally {
  if (backdatedId) await sql`delete from pay_rates where id = ${backdatedId}`;
  await cleanup();
}

finish("pay-rate");
