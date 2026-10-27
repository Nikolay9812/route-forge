// One active car for a mechanic: papers and talon (read-only), the last 7 days of vehicle checks with who drove,
// and its latest notes. Archived cars and cars of other firms answer 404.
import { isId } from "@/domain/shift";
import { apiError, handle } from "@/server/auth";
import { garageContext } from "@/server/context";
import { garageCar } from "@/server/garage";

export function GET(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const car = await garageCar(ctx, id);
    return car ? Response.json(car) : apiError("notFound");
  });
}
