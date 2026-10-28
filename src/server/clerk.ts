// Clerk's backend client, for server modules only (it reads CLERK_SECRET_KEY).
import { createClerkClient } from "@clerk/backend";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");

export const clerk = createClerkClient({ secretKey, publishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY });
