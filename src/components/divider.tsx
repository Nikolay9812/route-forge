import { View } from "react-native";

import { ThemedText } from "./themed-text";

// A hairline rule, optionally split by a short label ("or").
export function Divider({ label, className }: { label?: string; /** Layout only. */ className?: string }) {
  return (
    <View className={`flex-row items-center ${className ?? ""}`}>
      <View className="h-px flex-1 bg-border" />
      {label ? (
        <ThemedText variant="caption" color="ink-muted" className="px-3">
          {label}
        </ThemedText>
      ) : null}
      {label ? <View className="h-px flex-1 bg-border" /> : null}
    </View>
  );
}
