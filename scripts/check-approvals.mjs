// Approvals checks against a running dev server: depot scope for dispatchers, the whole firm for owners, approve,
// reject and resubmit, corrections with history, pay for one shift, and isolation from couriers and other firms.
// Uses the seeded data plus today's shifts it creates itself. Run with `npm run check:approvals` (after db:seed).
import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  c: await userByEmail("courier.c+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
};

// Today's shifts are created fresh: A at HBW3 (in the dispatcher's depots), C at HBW7 (outside), B in firm B.
const testCouriers = [users.a, users.c, users.b];
await sql`delete from shift_changes where shift_id in (select id from shifts where user_id = any(${testCouriers}) and date >= current_date - 1)`;
await sql`delete from shift_photos where shift_id in (select id from shifts where user_id = any(${testCouriers}) and date >= current_date - 1)`;
await sql`delete from shifts where user_id = any(${testCouriers}) and date >= current_date - 1`;

const token = {
  a: await tokenFor(users.a, ivanov),
  c: await tokenFor(users.c, ivanov),
  b: await tokenFor(users.b, firmB),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
};

async function startAndSubmit(courierToken, depotName, busPlate) {
  const today = (await call(courierToken, "GET", "/api/shifts/today")).json;
  const depotId = today.stations.find((s) => s.name === depotName).id;
  const carId = today.buses.find((b) => b.plate === busPlate).id;
  await call(courierToken, "POST", "/api/shifts/today", { depotId, carId, startKm: 1000, loaded: 100 });
  await call(courierToken, "PATCH", "/api/shifts/today", { endKm: 1080, returned: 4 });
  return (await call(courierToken, "POST", "/api/shifts/today/submit")).json;
}

const todayA = await startAndSubmit(token.a, "HBW3", "KH I 6004");
const todayC = await startAndSubmit(token.c, "HBW7", "KH I 7732");
const todayB = await startAndSubmit(token.b, "TFB1", "B TF 100");
check("test shifts submitted", [todayA, todayC, todayB].every((s) => s?.status === "submitted"));

// Who may use approvals at all.
let r = await call(token.a, "GET", "/api/approvals");
check("courier → 403", r.status === 403 && r.json?.error === "role", r.status);
r = await call(null, "GET", "/api/approvals");
check("no token → 401", r.status === 401, r.status);
r = await call(token.dispatcher, "GET", "/api/approvals?view=everything");
check("unknown view → 400", r.status === 400, r.status);

// Depot scope.
const pending = await call(token.dispatcher, "GET", "/api/approvals?view=pending");
const pendingIds = new Set(pending.json.items.map((i) => i.shift.id));
check("dispatcher sees A's HBW3 shift", pendingIds.has(todayA.id));
check("dispatcher doesn't see C's HBW7 shift", !pendingIds.has(todayC.id));
check(
  "dispatcher list only has HBW3/HBW1",
  pending.json.items.every((i) => ["HBW3", "HBW1"].includes(i.shift.depot.name)),
);
check("pending count matches the list", pending.json.pendingCount === pending.json.items.length);
check("courier names come from Clerk", pending.json.items.some((i) => i.courierName === "Anna Courier"));
r = await call(token.dispatcher, "GET", `/api/approvals/${todayC.id}`);
check("dispatcher opens HBW7 shift → 404", r.status === 404, r.status);
r = await call(token.dispatcher, "POST", `/api/approvals/${todayC.id}`, { action: "approve" });
check("dispatcher approves HBW7 shift → 404", r.status === 404, r.status);
r = await call(token.dispatcher, "GET", `/api/approvals/${todayB.id}`);
check("another firm's shift → 404", r.status === 404, r.status);
const ownerList = await call(token.owner, "GET", "/api/approvals?view=pending");
check("owner sees HBW7 too", ownerList.json.items.some((i) => i.shift.id === todayC.id));

// Detail and pay at the day's rate.
r = await call(token.dispatcher, "GET", `/api/approvals/${todayA.id}`);
const detail = r.json;
const day = Number(todayA.date.slice(8, 10));
check("detail loads with courier name", r.status === 200 && detail.courierName === "Anna Courier", r.status);
check(
  "rate is the firm default on the shift's day",
  detail.pay?.kind === "hourly" && detail.pay.amountMinor === (day >= 15 ? 1600 : 1500),
);
check(
  "pay = worked minutes × rate, rounded",
  detail.pay?.payMinor === Math.round((detail.shift.workedMinutes * detail.pay.amountMinor) / 60),
);
check(
  "worked = shift time − the law break",
  detail.shift.workedMinutes ===
    detail.shift.minutes - (detail.shift.minutes > 540 ? 45 : detail.shift.minutes > 360 ? 30 : 0),
);
check("Spesen over 8:00 h of shift time", detail.pay?.spesenMinor === (detail.shift.minutes > 480 ? 1400 : 0));
check("dispatcher's stations are HBW1/HBW3 only", detail.stations.map((s) => s.name).sort().join() === "HBW1,HBW3");

// Approve.
r = await call(token.dispatcher, "POST", `/api/approvals/${todayA.id}`, { action: "approve" });
check("approve → approved", r.status === 200 && r.json.status === "approved", r.status);
r = await call(token.dispatcher, "POST", `/api/approvals/${todayA.id}`, { action: "approve" });
check("approve again → 409", r.status === 409, r.status);
const reviewed = await call(token.dispatcher, "GET", "/api/approvals?view=reviewed");
check("approved shift is in Reviewed", reviewed.json.items.some((i) => i.shift.id === todayA.id));
r = await call(token.owner, "POST", `/api/approvals/${todayC.id}`, { action: "approve" });
check("owner approves HBW7 shift", r.status === 200 && r.json.status === "approved", r.status);

// Reject and the courier's fix.
// Reject one of courier A's past shifts (A's token checks the fix); correct any other pending one in scope.
const toReject = pending.json.items.find((i) => i.courierName === "Anna Courier" && i.shift.id !== todayA.id);
const toCorrect = pending.json.items.find((i) => i.shift.id !== todayA.id && i.shift.id !== toReject?.shift.id);
check("seed has past pending shifts to work with", Boolean(toReject && toCorrect));
r = await call(token.dispatcher, "POST", `/api/approvals/${toReject.shift.id}`, { action: "reject" });
check("reject with no reason or note → 400", r.status === 400, r.status);
r = await call(token.dispatcher, "POST", `/api/approvals/${toReject.shift.id}`, { action: "reject", reasons: ["nope"] });
check("unknown reason → 400", r.status === 400, r.status);
r = await call(token.dispatcher, "POST", `/api/approvals/${toReject.shift.id}`, { action: "reject", reasons: ["time"] });
check("the time reason is gone → 400", r.status === 400, r.status);
r = await call(token.dispatcher, "POST", `/api/approvals/${toReject.shift.id}`, {
  action: "reject",
  reasons: ["km", "packages"],
  note: "Check the odometer",
});
check("reject → rejected", r.status === 200 && r.json.status === "rejected", r.status);
r = await call(token.dispatcher, "PATCH", `/api/approvals/${toReject.shift.id}`, { endKm: 999999 });
check("correcting a rejected shift → 409", r.status === 409, r.status);

r = await call(token.a, "GET", `/api/shifts/${toReject.shift.id}`);
check(
  "courier sees the reasons and note",
  r.json?.shift.rejection?.reasons.join() === "km,packages" && r.json.shift.rejection.note === "Check the odometer",
);
const minutesBefore = r.json.shift.minutes;
const startedBefore = r.json.shift.startedAt;
r = await call(token.c, "GET", `/api/shifts/${toReject.shift.id}`);
check("another courier can't open it → 404", r.status === 404, r.status);
r = await call(token.c, "PATCH", `/api/shifts/${toReject.shift.id}`, { pickups: 1 });
check("another courier can't fix it → 404", r.status === 404, r.status);
r = await call(token.a, "PATCH", `/api/shifts/${toReject.shift.id}`, { startTime: "05:00" });
check("courier can't change the times of a sent-back shift → 400", r.status === 400 && r.json.error === "invalid", r.status);
r = await call(token.a, "PATCH", `/api/shifts/${toReject.shift.id}`, { finishTime: "23:00", pickups: 5 });
check("…not even alongside other fields → 400", r.status === 400, r.status);
r = await call(token.a, "GET", `/api/shifts/${toReject.shift.id}`);
check("the times are unchanged", r.json?.shift.startedAt === startedBefore && r.json.shift.minutes === minutesBefore);
r = await call(token.a, "PATCH", `/api/shifts/${toReject.shift.id}`, { pickups: 5 });
check("courier fixes the rejected shift", r.status === 200 && r.json.pickups === 5, r.status);
r = await call(token.a, "POST", `/api/shifts/${toReject.shift.id}/submit`);
check(
  "resubmit keeps the times and clears the rejection",
  r.status === 200 && r.json.status === "submitted" && r.json.minutes === minutesBefore && !r.json.rejection,
  `${r.status} ${r.json?.minutes} vs ${minutesBefore}`,
);
r = await call(token.a, "PATCH", `/api/shifts/${toReject.shift.id}`, { pickups: 6 });
check("fixing after resubmit → 409", r.status === 409, r.status);

// Corrections with history.
const target = toCorrect.shift;
const hbw7 = ownerList.json.items.find((i) => i.shift.id === todayC.id).shift.depot.id;
r = await call(token.dispatcher, "PATCH", `/api/approvals/${target.id}`, { depotId: hbw7 });
check("dispatcher moves a shift to HBW7 → 400", r.status === 400, r.status);
r = await call(token.dispatcher, "PATCH", `/api/approvals/${target.id}`, { startTime: "10:00", finishTime: "09:00" });
check("finish before start → 400", r.status === 400, r.status);
r = await call(token.dispatcher, "PATCH", `/api/approvals/${target.id}`, { firmId: firmB });
check("unknown field → 400", r.status === 400, r.status);
// Hand-checked: 07:30–16:12 is 8 h 42 min = 522 min; at €16.00/h that's €139.20, at €15.00/h €130.50.
r = await call(token.dispatcher, "PATCH", `/api/approvals/${target.id}`, {
  startTime: "07:30",
  finishTime: "16:12",
  endKm: target.startKm + 120,
});
check("correction saved and marked", r.status === 200 && r.json.corrected && r.json.minutes === 522, r.status);
r = await call(token.dispatcher, "GET", `/api/approvals/${target.id}`);
// 522 min (8:42 h) loses the 30-min law break → 492 worked min at the firm default in force on the shift's day
// (courier.a has no own rate; the seed changes the default mid-month), rounded half up.
const [{ amount_minor: hourly }] = await sql`
  select amount_minor from pay_rates
  where firm_id = (select firm_id from shifts where id = ${target.id}) and user_id is null
    and effective_from <= ${target.date}
  order by effective_from desc limit 1`;
const expectedPay = Math.round((492 * hourly) / 60);
check("the corrected shift has its new break", r.json.shift?.breakMinutes === 30 && r.json.shift.workedMinutes === 492);
check("8:42 h of shift time earns Spesen", r.json.pay?.spesenMinor === 1400);
check("pay after correction matches the hand calculation", r.json.pay?.payMinor === expectedPay, r.json.pay?.payMinor);
check(
  "history records who changed which fields",
  r.json.changes.length === 3 &&
    r.json.changes.every((c) => c.byName === "Dora Dispatcher") &&
    r.json.changes.map((c) => c.field).sort().join() === "endKm,finishedAt,startedAt",
);
check("still submitted after a correction", r.json.shift.status === "submitted");

// Correcting an approved shift moves the courier's month totals.
const homeBefore = (await call(token.a, "GET", "/api/pay")).json.totals;
r = await call(token.dispatcher, "PATCH", `/api/approvals/${todayA.id}`, { endKm: todayA.endKm + 25 });
check("approved shift can be corrected", r.status === 200 && r.json.status === "approved", r.status);
const homeAfter = (await call(token.a, "GET", "/api/pay")).json.totals;
check("courier's approved km went up by 25", homeAfter.km - homeBefore.km === 25, homeAfter.km - homeBefore.km);

// Filters and sort: inside the reviewer's scope only, with matching totals and pick lists.
const list = async (who, query) => call(token[who], "GET", `/api/approvals?${query}`);
const ownerPending = (await list("owner", "view=pending")).json;
const ownerReviewed = (await list("owner", "view=reviewed")).json;
const hbw3 = ownerPending.options.depots.find((d) => d.name === "HBW3")?.id;
const bus6004 = ownerPending.options.buses.find((b) => b.plate === "KH I 6004")?.id;
check("owner options list HBW7 and courier C", ownerPending.options.depots.some((d) => d.id === hbw7) && ownerPending.options.couriers.some((c) => c.userId === users.c));
const nameC = ownerPending.options.couriers.find((c) => c.userId === users.c)?.name;
check("unfiltered total = items", ownerPending.total === ownerPending.items.length);

for (const view of ["pending", "reviewed"]) {
  r = await list("owner", `view=${view}&depotId=${hbw3}`);
  check(`${view}: depot filter`, r.status === 200 && r.json.items.every((i) => i.shift.depot.id === hbw3) && r.json.total === r.json.items.length, r.status);
  r = await list("owner", `view=${view}&carId=${bus6004}`);
  check(`${view}: bus filter`, r.status === 200 && r.json.items.every((i) => i.shift.car.id === bus6004));
  r = await list("owner", `view=${view}&userId=${users.c}`);
  check(`${view}: courier filter`, r.status === 200 && r.json.items.every((i) => i.courierName === nameC));
  r = await list("owner", `view=${view}&photos=missing`);
  check(`${view}: missing photos filter`, r.status === 200 && r.json.items.every((i) => i.shift.photoCount < 8));
  r = await list("owner", `view=${view}&corrected=1`);
  check(`${view}: corrected filter`, r.status === 200 && r.json.items.every((i) => i.shift.corrected));
  check(`${view}: options don't depend on the view`, JSON.stringify(r.json.options) === JSON.stringify(ownerPending.options));
}
r = await list("owner", "view=reviewed&corrected=1");
check("approved corrected shift A shows under corrected", r.json.items.some((i) => i.shift.id === todayA.id));
// The owner approved C's shift above, so it's in Reviewed now.
r = await list("owner", `view=reviewed&userId=${users.c}`);
check("courier C's shift found by courier", r.json.items.some((i) => i.shift.id === todayC.id) && r.json.items.every((i) => i.shift.id !== todayA.id));
for (const status of ["approved", "rejected"]) {
  r = await list("owner", `view=reviewed&status=${status}`);
  check(`reviewed: status=${status}`, r.status === 200 && r.json.items.every((i) => i.shift.status === status));
}
check("pending count stays unfiltered", (await list("owner", `view=pending&depotId=${hbw3}`)).json.pendingCount === ownerPending.pendingCount);

const sorted = (items, key) => items.every((x, i) => i === 0 || key(items[i - 1]).localeCompare(key(x)) <= 0);
r = await list("owner", "view=reviewed&sort=depot");
check("sort by depot", sorted(r.json.items, (i) => i.shift.depot.name.toLowerCase()) && r.json.items.length === ownerReviewed.items.length);
r = await list("owner", "view=reviewed&sort=bus");
check("sort by bus", sorted(r.json.items, (i) => i.shift.car.plate));
r = await list("owner", "view=reviewed&sort=courier");
check("sort by courier", sorted(r.json.items, (i) => i.courierName));

// Scope: an ID outside the dispatcher's depots or the firm matches nothing, and never errors.
r = await list("dispatcher", `view=pending&depotId=${hbw7}`);
check("dispatcher filters by HBW7 → empty", r.status === 200 && r.json.items.length === 0 && r.json.total === 0, r.status);
r = await list("dispatcher", `view=pending&userId=${users.c}`);
check("dispatcher filters by courier C → no HBW7 shift", r.status === 200 && !r.json.items.some((i) => i.shift.id === todayC.id));
r = await list("dispatcher", "view=pending");
check("dispatcher options only hold their depots", r.json.options.depots.every((d) => ["HBW3", "HBW1"].includes(d.name)));
check("firm B courier with an Ivanov depot → 403", (await call(token.b, "GET", `/api/approvals?view=pending&depotId=${hbw3}`)).status === 403);

// Malformed parameters.
for (const query of [
  "view=pending&status=approved",
  "view=reviewed&status=draft",
  "view=pending&depotId=nope",
  "view=pending&carId=1",
  "view=pending&userId=org_1",
  "view=pending&sort=pay",
  "view=pending&photos=all",
  "view=pending&corrected=yes",
]) {
  r = await list("owner", query);
  check(`${query} → 400`, r.status === 400 && r.json?.error === "invalid", r.status);
}

finish("approvals");
