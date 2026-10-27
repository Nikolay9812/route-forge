// The firm's dated break and Spesen rules on the server. The break is computed in SQL so shift reads and the Team
// totals get it without loading rules; it mirrors breakFor() in src/domain/salary.ts (check:pay compares them).
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { firmRules, shifts } from "@/db/schema";
import type { WorkRule } from "@/domain/types";

/**
 * A shift's automatic break from the rule in force on its day: null while the shift has no minutes, 0 without a
 * rule. "Over" is strict, and the break never exceeds the shift time.
 */
export const breakMinutesSql = sql<number | null>`case when ${shifts.minutes} is null then null else coalesce((
  select case
    when ${shifts.minutes} > ${firmRules.longBreakAfterMinutes} then least(${firmRules.longBreakMinutes}, ${shifts.minutes})
    when ${shifts.minutes} > ${firmRules.breakAfterMinutes} then least(${firmRules.breakMinutes}, ${shifts.minutes})
    else 0 end
  from ${firmRules}
  where ${firmRules.firmId} = ${shifts.firmId} and ${firmRules.effectiveFrom} <= ${shifts.date}
  order by ${firmRules.effectiveFrom} desc
  limit 1), 0) end`;

const ruleColumns = {
  effectiveFrom: firmRules.effectiveFrom,
  breakAfterMinutes: firmRules.breakAfterMinutes,
  breakMinutes: firmRules.breakMinutes,
  longBreakAfterMinutes: firmRules.longBreakAfterMinutes,
  longBreakMinutes: firmRules.longBreakMinutes,
  spesenAfterMinutes: firmRules.spesenAfterMinutes,
  spesenMinor: firmRules.spesenMinor,
};

/** Every rule entry of the firm, newest first: what Spesen math and the owner's history need. */
export async function loadRules(firmId: string): Promise<WorkRule[]> {
  return db.select(ruleColumns).from(firmRules).where(eq(firmRules.firmId, firmId)).orderBy(desc(firmRules.effectiveFrom));
}

