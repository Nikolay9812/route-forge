import "@/global.css";

import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AuthProvider, useAuth } from "@/auth";
import { useLanguage } from "@/i18n";
import { fontFiles, fontScriptFor, FontScriptProvider, useThemeColor, type FontScript } from "@/theme";

SplashScreen.preventAutoHideAsync();

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
// sends the user to index, which redirects by auth state.
function RootStack() {
  const { isSignedIn } = useAuth();
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

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <FontScriptProvider script={script}>
      <ThemeProvider value={theme}>
        <StatusBar style="auto" />
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </ThemeProvider>
    </FontScriptProvider>
  );
}
