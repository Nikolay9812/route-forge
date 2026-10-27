import { Redirect } from "expo-router";

import { isReviewer, useAuth, useFirm } from "@/auth";

// Entry point: signed-out users start at onboarding. Signed-in dispatchers and owners go to their approvals, mechanics
// to the cars, everyone else home (where a user without a firm sees "No firm yet"). Nothing renders while the firm is
// being activated.
export default function Index() {
  const { isSignedIn } = useAuth();
  const { firm } = useFirm();
  if (!isSignedIn) return <Redirect href="/onboarding" />;
  if (firm.status === "loading") return null;
  const role = firm.status === "ready" ? firm.role : null;
  return <Redirect href={isReviewer(role) ? "/approvals" : role === "mechanic" ? "/cars" : "/home"} />;
}
