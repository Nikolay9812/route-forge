// Filters and sort for the Approvals list: the query string the app sends and the server parses. Pure: shared by
// the API route, the app and check scripts.

export type ReviewView = "pending" | "reviewed";
export type ReviewSort = "date" | "courier" | "depot" | "bus";

export const reviewSorts: readonly ReviewSort[] = ["date", "courier", "depot", "bus"];

export type ReviewFilters = {
  depotId: string | null;
  carId: string | null;
  userId: string | null;
  /** Only shifts with fewer than the expected vehicle check photos. */
  missingPhotos: boolean;
  corrected: boolean;
  /** Reviewed only; null = approved and rejected. */
  status: "approved" | "rejected" | null;
  sort: ReviewSort;
};

export const emptyReviewFilters: ReviewFilters = {
  depotId: null,
  carId: null,
  userId: null,
  missingPhotos: false,
  corrected: false,
  status: null,
  sort: "date",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_ID = /^user_[A-Za-z0-9]{1,64}$/;

/** True when anything but the sort narrows the list (status counts only in Reviewed). */
export function isFiltered(filters: ReviewFilters, view: ReviewView): boolean {
  return Boolean(
    filters.depotId ||
      filters.carId ||
      filters.userId ||
      filters.missingPhotos ||
      filters.corrected ||
      (view === "reviewed" && filters.status),
  );
}

/** The list URL's query: only the parameters that differ from the defaults. */
export function reviewQuery(view: ReviewView, filters: ReviewFilters): string {
  const params = new URLSearchParams({ view });
  if (filters.depotId) params.set("depotId", filters.depotId);
  if (filters.carId) params.set("carId", filters.carId);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.missingPhotos) params.set("photos", "missing");
  if (filters.corrected) params.set("corrected", "1");
  if (view === "reviewed" && filters.status) params.set("status", filters.status);
  if (filters.sort !== "date") params.set("sort", filters.sort);
  return params.toString();
}

/** The view and filters of a list request, or null when any parameter is malformed. */
export function parseReviewQuery(params: URLSearchParams): { view: ReviewView; filters: ReviewFilters } | null {
  const view = params.get("view") ?? "pending";
  if (view !== "pending" && view !== "reviewed") return null;

  const depotId = params.get("depotId");
  const carId = params.get("carId");
  const userId = params.get("userId");
  if ((depotId !== null && !UUID.test(depotId)) || (carId !== null && !UUID.test(carId))) return null;
  if (userId !== null && !USER_ID.test(userId)) return null;

  const photos = params.get("photos");
  const corrected = params.get("corrected");
  if ((photos !== null && photos !== "missing") || (corrected !== null && corrected !== "1")) return null;

  const status = params.get("status");
  if (status !== null && (view !== "reviewed" || (status !== "approved" && status !== "rejected"))) return null;

  const sort = params.get("sort") ?? "date";
  if (!reviewSorts.includes(sort as ReviewSort)) return null;

  return {
    view,
    filters: {
      depotId,
      carId,
      userId,
      missingPhotos: photos === "missing",
      corrected: corrected === "1",
      status,
      sort: sort as ReviewSort,
    },
  };
}

/** Pick-list options, unfiltered and the same for both views: every depot, courier and bus with a shift in either. */
export type ReviewOptions = {
  depots: { id: string; name: string }[];
  couriers: { userId: string; name: string }[];
  buses: { id: string; plate: string }[];
};

/** Drops saved IDs that no longer appear in the view's options (another scope, a removed courier). */
export function pruneReviewFilters(filters: ReviewFilters, options: ReviewOptions): ReviewFilters {
  return {
    ...filters,
    depotId: options.depots.some((d) => d.id === filters.depotId) ? filters.depotId : null,
    carId: options.buses.some((b) => b.id === filters.carId) ? filters.carId : null,
    userId: options.couriers.some((c) => c.userId === filters.userId) ? filters.userId : null,
  };
}
