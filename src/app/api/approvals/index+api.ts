// The approvals queue for dispatchers (their depots) and owners (the whole firm).
import { apiError, handle } from "@/server/auth";
import { reviewList } from "@/server/approvals";
import { reviewerContext } from "@/server/context";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await reviewerContext(request);
    if (ctx instanceof Response) return ctx;
    const view = new URL(request.url).searchParams.get("view") ?? "pending";
    if (view !== "pending" && view !== "reviewed") return apiError("invalid");
    return Response.json({ firm: ctx.firm, ...(await reviewList(ctx.scope, view)) });
  });
}
