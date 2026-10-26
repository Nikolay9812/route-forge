import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";

import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { SectionForm } from "@/components/documents/section-form";
import { useDocuments } from "@/documents/documents";
import { detailsSections } from "@/domain/courier-details";
import type { DetailsSection } from "@/domain/types";
import { useTranslation } from "@/i18n";

// One document section: the courier's own (no userId) or, for an owner, that courier's.
export default function DocumentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ section: string; userId?: string }>();
  const section = detailsSections.find((s) => s === params.section) ?? ("idCard" satisfies DetailsSection);
  const { resource, reload, save } = useDocuments(params.userId);

  if (resource.status === "ready") {
    return (
      <SectionForm section={section} documents={resource.data} withPhotos={!params.userId} save={save} />
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: t(`documents.sections.${section}`) }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 px-4 pt-4 pb-8"
      >
        {resource.status === "loading" ? (
          <DocumentsSkeleton />
        ) : (
          <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />
        )}
      </ScrollView>
    </>
  );
}
