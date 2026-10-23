import { Redirect } from "expo-router";

import { useAuth } from "@/auth";

// Entry point: signed-in users go home, everyone else starts at onboarding.
export default function Index() {
  const { isSignedIn } = useAuth();
  return <Redirect href={isSignedIn ? "/home" : "/onboarding"} />;
}
