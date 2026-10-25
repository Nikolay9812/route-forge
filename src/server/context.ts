import type { Firm } from "@/domain/types";

import { apiError, requireCourier, type Courier } from "./auth";
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
