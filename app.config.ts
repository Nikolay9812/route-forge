import type { ConfigContext, ExpoConfig } from "expo/config";

// Everything lives in app.json; this only builds in the API origin. Each EAS environment sets APP_ORIGIN to its own
// EAS Hosting deployment (preview → the dev services, production → https://route-forge.expo.app), so the app's
// relative `fetch("/api/...")` reaches the right server. Unset locally: development uses the dev server.
export default ({ config }: ConfigContext): ExpoConfig => {
  const origin = process.env.APP_ORIGIN;
  if (!origin) return config as ExpoConfig;
  return {
    ...config,
    plugins: (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === "expo-router" ? ["expo-router", { ...plugin[1], origin }] : plugin,
    ),
  } as ExpoConfig;
};
