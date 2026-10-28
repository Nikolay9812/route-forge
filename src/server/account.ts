// Deleting one's own account (the app stores require it in-app). The login, the courier documents and their photos
// and dispatcher depot rows go. Shifts, pay, shift photos, service log notes and pay rate entries stay: they are the
// firm's salary history, which it must keep, and they show the person as "Deleted user". Owners can't delete
// themselves here, since that would leave the firm without an owner.
//
// This is the one place that queries by user rather than firm: a person may hold documents in several firms (removing
// a member keeps them), and deleting the account deletes their data in all of them. The user ID comes from the
// verified session only.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { courierDetails, dispatcherDepots, documentPhotos } from "@/db/schema";

import { clerk } from "./auth";
import { deleteObject } from "./storage";

/** True when the user owns any firm, so the account can't be deleted from the app. */
export async function ownsAFirm(userId: string): Promise<boolean> {
  const { data } = await clerk.users.getOrganizationMembershipList({ userId, limit: 100 });
  return data.some((membership) => membership.role === "org:owner");
}

/** Deletes the user's files, then their rows, then the Clerk user. Safe to repeat if a step failed half way. */
export async function deleteAccount(userId: string): Promise<void> {
  const photos = await db
    .select({ objectKey: documentPhotos.objectKey })
    .from(documentPhotos)
    .where(eq(documentPhotos.userId, userId));
  for (const photo of photos) await deleteObject(photo.objectKey);
  await db.batch([
    db.delete(documentPhotos).where(eq(documentPhotos.userId, userId)),
    db.delete(courierDetails).where(eq(courierDetails.userId, userId)),
    db.delete(dispatcherDepots).where(eq(dispatcherDepots.userId, userId)),
  ]);
  await clerk.users.deleteUser(userId);
}
