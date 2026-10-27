// The mechanic's car list: every active depot of the firm with its active cars. Mechanics and owners only.
import { handle } from "@/server/auth";
import { garageContext } from "@/server/context";
import { garageOf } from "@/server/garage";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    return Response.json(await garageOf(ctx.firmId, ctx.date));
  });
}
