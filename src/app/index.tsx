import { Link } from "expo-router";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-canvas px-4">
      <ThemedText variant="heading">welcome to the new app</ThemedText>
      {__DEV__ ? (
        <Link href="/design-system">
          <ThemedText variant="label" color="secondary-ink">
            Design system
          </ThemedText>
        </Link>
      ) : null}
    </View>
  );
}
