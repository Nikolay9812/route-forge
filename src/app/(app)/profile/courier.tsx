import { router, Stack, useLocalSearchParams } from "expo-router";
import { RefreshControl, ScrollView } from "react-native";

import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { SectionRows } from "@/components/documents/section-rows";
import { SectionEntrance } from "@/components/home/section-entrance";
import { useDocuments } from "@/documents/documents";
import { useThemeColor } from "@/theme";

// One courier's documents for the owner: the same sections the courier sees, each opening its form.
export default function CourierScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const spinner = useThemeColor("secondary-ink");
  const { resource, refreshing, reload } = useDocuments(userId);
  const data = resource.status === "ready" ? resource.data : null;

  return (
    <>
      <Stack.Screen options={{ title: data?.name ?? "" }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 px-4 pt-4 pb-8"
        refreshControl={
          data ? (
            <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} />
          ) : undefined
        }
      >
        {resource.status === "loading" ? (
          <DocumentsSkeleton rows={1} />
        ) : resource.status === "failed" ? (
          <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />
        ) : (
          <SectionEntrance index={0}>
            <SectionRows
              sections={resource.data.sections}
              onOpen={(section) => router.push({ pathname: "/profile/document", params: { section, userId } })}
            />
          </SectionEntrance>
        )}
      </ScrollView>
    </>
  );
}
