import type { Firm } from "@/domain/types";

import { scopeOf, type ReviewScope } from "./approvals";
import {
  apiError,
  requireCourier,
  requireGarageSession,
  requireOwner,
  requireReviewerSession,
  type Courier,
  type GarageUser,
  type Owner,
} from "./auth";
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

export type OwnerContext = Owner & { firm: Firm; date: string };

/** Session → firm → owner, once the firm is set up. Depots, cars and pay rates are managed by owners only. */
export async function ownerContext(request: Request): Promise<OwnerContext | Response> {
  const owner = await requireOwner(request);
  if (owner instanceof Response) return owner;
  const firm = await loadFirm(owner.firmId);
  if (!firm) return apiError("firmNotSetUp");
  return { ...owner, firm, date: firmToday(firm) };
}

export type GarageContext = GarageUser & { firm: Firm; date: string };

/** Session → firm → mechanic or owner, once the firm is set up: the cars, recent vehicle checks and the service log. */
export async function garageContext(request: Request): Promise<GarageContext | Response> {
  const user = await requireGarageSession(request);
  if (user instanceof Response) return user;
  const firm = await loadFirm(user.firmId);
  if (!firm) return apiError("firmNotSetUp");
  return { ...user, firm, date: firmToday(firm) };
}
