import { View } from "react-native";

// Static blocks in Home's layout while data loads. No shimmer: a loop would run on every cold start for nothing.
export function HomeSkeleton() {
  return (
    <View className="gap-6" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View className="flex-row items-center justify-between">
        <View className="gap-2">
          <View className="h-3 w-32 rounded-sm bg-border" />
          <View className="h-6 w-52 rounded-sm bg-border" />
        </View>
        <View className="size-icon-button rounded-full bg-border" />
      </View>
      <View className="h-40 rounded-lg bg-border" />
      <View className="h-32 rounded-lg bg-border" />
      <View className="gap-3">
        <View className="h-14 rounded-md bg-border" />
        <View className="h-14 rounded-md bg-border" />
        <View className="h-14 rounded-md bg-border" />
      </View>
    </View>
  );
}
