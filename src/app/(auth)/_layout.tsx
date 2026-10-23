import { Stack } from "expo-router";

// Auth screens draw their own header (back button and wordmark).
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
