import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import "@/global.css";

import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { useAuth } from "@/auth";
import { useLanguage } from "@/i18n";
import { fontFiles, fontScriptFor, FontScriptProvider, restoreColorScheme, useThemeColor, type FontScript } from "@/theme";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add your key to .env.local.\nRun: 1) clerk auth login  2) clerk link  3) clerk env pull — then restart the dev server.");
}

SplashScreen.preventAutoHideAsync();
restoreColorScheme();

const navigationFonts: Record<FontScript, Theme["fonts"]> = {
  latin: {
    regular: { fontFamily: "PlusJakartaSans-Regular", fontWeight: "400" },
    medium: { fontFamily: "PlusJakartaSans-Medium", fontWeight: "500" },
    bold: { fontFamily: "PlusJakartaSans-Bold", fontWeight: "700" },
    heavy: { fontFamily: "PlusJakartaSans-ExtraBold", fontWeight: "800" },
  },
  cyrillic: {
    regular: { fontFamily: "Manrope-Regular", fontWeight: "400" },
    medium: { fontFamily: "Manrope-Medium", fontWeight: "500" },
    bold: { fontFamily: "Manrope-Bold", fontWeight: "700" },
    heavy: { fontFamily: "Manrope-ExtraBold", fontWeight: "800" },
  },
};

// Headers, tab bars and screen backgrounds follow the tokens too.
function useNavigationTheme(script: FontScript): Theme {
  const dark = useColorScheme() === "dark";
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: useThemeColor("secondary-ink"),
      background: useThemeColor("canvas"),
      card: useThemeColor("surface"),
      text: useThemeColor("ink"),
      border: useThemeColor("border"),
      notification: useThemeColor("danger"),
    },
    fonts: navigationFonts[script],
  };
}

// Signed-out users only reach onboarding and (auth); signed-in users only (app). A guard turning false
// sends the user to index, which redirects by auth state. Nothing renders, and the splash stays up,
// until Clerk has restored the session from the token cache, so onboarding never flashes for a signed-in user.
function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const ready = fontsReady && isLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="design-system" options={{ headerShown: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);
  const script = fontScriptFor(useLanguage());
  const theme = useNavigationTheme(script);

  // Offline requests reject with network_error instead of resolving empty, so screens show the offline alert.
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      experimental={{ rethrowOfflineNetworkErrors: true }}
    >
      <FontScriptProvider script={script}>
        <ThemeProvider value={theme}>
          <StatusBar style="auto" />
          <RootStack fontsReady={loaded || !!error} />
        </ThemeProvider>
      </FontScriptProvider>
    </ClerkProvider>
  );
}