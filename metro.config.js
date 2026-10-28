const path = require("node:path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativewind } = require("nativewind/metro");

// Expo's default config plus Sentry's debug IDs, so release builds upload matching source maps.
const config = withNativewind(getSentryExpoConfig(__dirname));

// NativeWind swaps `react-native` for its className-aware re-export, which drops newer exports such as
// RN 0.88's AssetRegistry. expo-asset needs that to load fonts on native, so libraries get the real module.
// Our own code (outside node_modules) still goes through NativeWind for className.
const nativewindResolveRequest = config.resolver.resolveRequest;
const nodeModules = `${path.sep}node_modules${path.sep}`;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native" && platform !== "web" && context.originModulePath.includes(nodeModules)) {
    return context.resolveRequest(context, moduleName, platform);
  }
  return nativewindResolveRequest(context, moduleName, platform);
};

module.exports = config;
