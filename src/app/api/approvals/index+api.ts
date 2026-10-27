// The approvals queue for dispatchers (their depots) and owners (the whole firm), with optional filters and sort.
import { parseReviewQuery } from "@/domain/review-filters";
import { apiError, handle } from "@/server/auth";
import { reviewList } from "@/server/approvals";
import { reviewerContext } from "@/server/context";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await reviewerContext(request);
    if (ctx instanceof Response) return ctx;
    const query = parseReviewQuery(new URL(request.url).searchParams);
    if (!query) return apiError("invalid");
    return Response.json({ firm: ctx.firm, ...(await reviewList(ctx.scope, query.view, query.filters)) });
  });
}
