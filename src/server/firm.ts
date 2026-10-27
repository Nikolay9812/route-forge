// The owner's Firm settings: currency and timezone (only while the firm has no shifts) and the dated break and
// Spesen rules, which change like pay rates: only upcoming entries can be edited or cancelled.
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { firmRules, firmSettings, shifts } from "@/db/schema";
import { todayIn } from "@/domain/dates";
import { DEFAULT_SETTINGS } from "@/domain/firm";
import { ruleFor } from "@/domain/salary";
import type { ApiErrorCode, FirmSettings, WorkRule, WorkRuleEntry } from "@/domain/types";

import { firmName, userNames } from "./auth";
import { uniqueWrite } from "./fleet";

type RuleRow = typeof firmRules.$inferSelect;

const ruleOf = (row: RuleRow): WorkRule => ({
  effectiveFrom: row.effectiveFrom,
  breakAfterMinutes: row.breakAfterMinutes,
  breakMinutes: row.breakMinutes,
  longBreakAfterMinutes: row.longBreakAfterMinutes,
  longBreakMinutes: row.longBreakMinutes,
  spesenAfterMinutes: row.spesenAfterMinutes,
  spesenMinor: row.spesenMinor,
});

/** True once the firm has any shift: from then on currency and timezone stay as they are. */
async function hasShifts(firmId: string): Promise<boolean> {
  const [row] = await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.firmId, firmId)).limit(1);
  return !!row;
}

/** The firm's today, also before it has a settings row (then in the default timezone). */
export async function settingsToday(firmId: string): Promise<string> {
  const [settings] = await db.select().from(firmSettings).where(eq(firmSettings.firmId, firmId));
  return todayIn((settings ?? DEFAULT_SETTINGS).timeZone);
}

/**
 * The settings screen. A firm without a settings row gets the defaults saved on first open, so the rest of the
 * app stops answering `firmNotSetUp`; they stay editable until the first shift.
 */
export async function firmSettingsView(firmId: string): Promise<FirmSettings> {
  await db.insert(firmSettings).values({ firmId, ...DEFAULT_SETTINGS }).onConflictDoNothing();
  const [[settings], rows, locked, name] = await Promise.all([
    db.select().from(firmSettings).where(eq(firmSettings.firmId, firmId)),
    db.select().from(firmRules).where(eq(firmRules.firmId, firmId)).orderBy(desc(firmRules.effectiveFrom)),
    hasShifts(firmId),
    firmName(firmId),
  ]);
  const { currency, timeZone } = settings ?? DEFAULT_SETTINGS;
  const today = todayIn(timeZone);
  const rules = rows.map(ruleOf);
  const rule = ruleFor(today, rules);
  const next = rules.filter((r) => r.effectiveFrom > today).at(-1) ?? null;
  const names = await userNames([...new Set(rows.map((r) => r.setBy))]);
  const entries: WorkRuleEntry[] = rows.map((row) => ({
    ...ruleOf(row),
    id: row.id,
    upcoming: row.effectiveFrom > today,
    current: rule?.effectiveFrom === row.effectiveFrom,
    setByName: names.get(row.setBy) ?? "",
    setAt: row.setAt.toISOString(),
  }));
  return { today, name, currency, timeZone, locked, rule, next, entries };
}

/** Creates or changes the settings row; `notEditable` once the firm has shifts. */
export async function saveSettings(
  firmId: string,
  input: { currency: string; timeZone: string },
): Promise<"notEditable" | null> {
  if (await hasShifts(firmId)) return "notEditable";
  await db
    .insert(firmSettings)
    .values({ firmId, ...input })
    .onConflictDoUpdate({ target: firmSettings.firmId, set: input });
  return null;
}

export async function createRule(firmId: string, ownerId: string, rule: WorkRule): Promise<"taken" | null> {
  const written = await uniqueWrite(() => db.insert(firmRules).values({ firmId, ...rule, setBy: ownerId }));
  return written === "taken" ? written : null;
}

async function upcomingRule(firmId: string, id: string, today: string): Promise<RuleRow | ApiErrorCode> {
  const [row] = await db
    .select()
    .from(firmRules)
    .where(and(eq(firmRules.firmId, firmId), eq(firmRules.id, id)));
  if (!row) return "notFound";
  return row.effectiveFrom > today ? row : "notEditable";
}

/** Replaces an upcoming entry whole; it may move to any day, even a past one, after the app's warning. */
export async function updateRule(
  firmId: string,
  ownerId: string,
  id: string,
  rule: WorkRule,
  today: string,
): Promise<ApiErrorCode | null> {
  const row = await upcomingRule(firmId, id, today);
  if (typeof row === "string") return row;
  const written = await uniqueWrite(() =>
    db
      .update(firmRules)
      .set({ ...rule, setBy: ownerId, setAt: new Date() })
      .where(and(eq(firmRules.firmId, firmId), eq(firmRules.id, id))),
  );
  return written === "taken" ? written : null;
}

/** Cancels an upcoming entry. No shift ever depended on it, so the row goes. */
export async function deleteRule(firmId: string, id: string, today: string): Promise<ApiErrorCode | null> {
  const row = await upcomingRule(firmId, id, today);
  if (typeof row === "string") return row;
  await db.delete(firmRules).where(and(eq(firmRules.firmId, firmId), eq(firmRules.id, id)));
  return null;
}
