import { View } from "react-native";

// Static blocks in the Shifts layout while today's shift loads. No shimmer, as on Home.
export function ShiftsSkeleton() {
  return (
    <View className="gap-6" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View className="gap-2">
        <View className="h-6 w-48 rounded-sm bg-border" />
        <View className="h-3 w-32 rounded-sm bg-border" />
      </View>
      <View className="h-80 rounded-lg bg-border" />
    </View>
  );
}
