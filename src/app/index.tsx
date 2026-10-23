import { Redirect } from "expo-router";

// Signed-out entry. The auth plan sends signed-in users to their home screen instead.
export default function Index() {
  return <Redirect href="/onboarding" />;
}
