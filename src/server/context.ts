import type { Firm } from "@/domain/types";

import { scopeOf, type ReviewScope } from "./approvals";
import { apiError, requireCourier, requireReviewerSession, type Courier } from "./auth";
import { firmToday, loadFirm } from "./shifts";

export type CourierContext = { courier: Courier; firm: Firm; date: string };

/** Session → firm → role, plus the firm's settings and today's date in its timezone. Or the error to return. */
export async function courierContext(request: Request): Promise<CourierContext | Response> {
  const courier = await requireCourier(request);
  if (courier instanceof Response) return courier;
  const firm = await loadFirm(courier.firmId);
  if (!firm) return apiError("firmNotSetUp");
  return { courier, firm, date: firmToday(firm) };
}

export type ReviewerContext = { scope: ReviewScope; firm: Firm };

/** Session → firm → dispatcher or owner, plus the depots they may act on and the firm's settings. */
export async function reviewerContext(request: Request): Promise<ReviewerContext | Response> {
  const reviewer = await requireReviewerSession(request);
  if (reviewer instanceof Response) return reviewer;
  const firm = await loadFirm(reviewer.firmId);
  if (!firm) return apiError("firmNotSetUp");
  return { scope: await scopeOf(reviewer), firm };
}
