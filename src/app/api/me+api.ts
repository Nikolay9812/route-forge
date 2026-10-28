// The signed-in user's own account. GET answers the active firm and their role in it (claiming the role row on a
// member's first visit). DELETE removes the account for good (see src/server/account.ts for what stays). Any role
// but owner, with or without a firm.
import type { MeView } from "@/domain/types";
import { deleteAccount, ownsAFirm } from "@/server/account";
import { apiError, handle, requireFirmSession, requireSession } from "@/server/auth";

export function GET(request: Request) {
  return handle(async () => {
    const session = await requireFirmSession(request);
    if (session instanceof Response) return session;
    return Response.json({ firmId: session.firmId, role: session.role } satisfies MeView);
  });
}

export function DELETE(request: Request) {
  return handle(async () => {
    const session = await requireSession(request);
    if (session instanceof Response) return session;
    if (await ownsAFirm(session.userId)) return apiError("notEditable");
    await deleteAccount(session.userId);
    return Response.json({ deleted: true });
  });
}
