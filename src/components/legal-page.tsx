import { Stack } from "expo-router";
import { ScrollView } from "react-native";

import { ThemedText } from "./themed-text";

// A plain text page reachable signed in or out (privacy policy, how to delete an account), also served on the web
// for the store listings. The body is one translation string with paragraphs split by blank lines; a paragraph
// starting with "# " is a section heading.
export function LegalPage({ title, body }: { title: string; body: string }) {
  return (
    <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-4 p-4 pb-8">
      <Stack.Screen options={{ title, headerShown: true }} />
      {body.split("\n\n").map((paragraph, i) =>
        paragraph.startsWith("# ") ? (
          <ThemedText key={i} variant="label" accessibilityRole="header" className="mt-2">
            {paragraph.slice(2)}
          </ThemedText>
        ) : (
          <ThemedText key={i} variant="body" color="ink">
            {paragraph}
          </ThemedText>
        ),
      )}
    </ScrollView>
  );
}
