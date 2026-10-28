// The signed-in user's own account. DELETE removes it for good (see src/server/account.ts for what stays). Any role
// but owner, with or without a firm.
import { deleteAccount, ownsAFirm } from "@/server/account";
import { apiError, handle, requireSession } from "@/server/auth";

export function DELETE(request: Request) {
  return handle(async () => {
    const session = await requireSession(request);
    if (session instanceof Response) return session;
    if (await ownsAFirm(session.userId)) return apiError("notEditable");
    await deleteAccount(session.userId);
    return Response.json({ deleted: true });
  });
}
