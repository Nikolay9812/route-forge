import { Redirect } from "expo-router";

// Google sign-in returns to routeforge://sso-callback. The browser session normally catches it; if the
// OS hands the link to the router instead, index sends the user on by auth state.
export default function SSOCallback() {
  return <Redirect href="/" />;
}
