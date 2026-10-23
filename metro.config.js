const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = withNativewind(getDefaultConfig(__dirname));

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
