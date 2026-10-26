import { router } from "expo-router";
import { Fragment } from "react";
import { RefreshControl, ScrollView } from "react-native";

import { DocumentsFailure, DocumentsSkeleton } from "@/components/documents/load-state";
import { Divider } from "@/components/divider";
import { SectionEntrance } from "@/components/home/section-entrance";
import { RateRow } from "@/components/pay-rates/rate-row";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { useCouriers } from "@/documents/documents";
import { detailsSections } from "@/domain/courier-details";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

// The owner's couriers with how complete their documents are; expired documents first in each row's tag.
export default function CouriersScreen() {
  const { t } = useTranslation();
  const spinner = useThemeColor("secondary-ink");
  const { resource, refreshing, reload } = useCouriers();
  const data = resource.status === "ready" ? resource.data : null;

  return (
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
        <DocumentsSkeleton />
      ) : resource.status === "failed" ? (
        <DocumentsFailure failure={resource.failure} onRetry={() => reload()} />
      ) : resource.data.couriers.length === 0 ? (
        <ThemedText variant="body" color="ink-muted" className="py-6 text-center">
          {t("documents.empty")}
        </ThemedText>
      ) : (
        <SectionEntrance index={0}>
          <Surface className="overflow-hidden">
            {resource.data.couriers.map((courier, i) => (
              <Fragment key={courier.userId}>
                {i > 0 ? <Divider className="mx-4" /> : null}
                <RateRow
                  title={courier.name}
                  detail={t("documents.progress", { done: courier.complete, total: detailsSections.length })}
                  trailing={
                    courier.expired > 0 ? (
                      <Tag tone="rejected" size="sm" label={t("documents.expiredCount", { count: courier.expired })} />
                    ) : courier.expiring > 0 ? (
                      <Tag tone="highlight" size="sm" label={t("documents.expiringCount", { count: courier.expiring })} />
                    ) : null
                  }
                  onPress={() => router.push({ pathname: "/profile/courier", params: { userId: courier.userId } })}
                />
              </Fragment>
            ))}
          </Surface>
        </SectionEntrance>
      )}
    </ScrollView>
  );
}
