import { useEffect, useState } from "react";
import { Platform, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApprovalList, type ApprovalsView } from "@/approvals/approvals";
import { useApprovalFilters } from "@/approvals/filters";
import { Alert } from "@/components/alert";
import { ReviewFilterBar } from "@/components/approvals/review-filters";
import { ReviewList } from "@/components/approvals/review-list";
import { Button } from "@/components/button";
import { useFormat } from "@/components/home/format";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Notice } from "@/components/notice";
import { SegmentedControl } from "@/components/segmented-control";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { isFiltered, pruneReviewFilters } from "@/domain/review-filters";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

// Formats nothing visible: only used until the firm's own settings have loaded.
const beforeLoad = { timeZone: "UTC", currency: "EUR" };

// The dispatcher's (or owner's) queue: submitted shifts to decide on, and what was reviewed in the last 30 days,
// filtered by depot, courier, bus, photos, corrections and status, and sorted. Filters are remembered per firm.
export default function Approvals() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const spinner = useThemeColor("secondary-ink");
  const [view, setView] = useState<ApprovalsView>("pending");
  const { filters, setFilters } = useApprovalFilters();
  const { resource, refreshing, reload } = useApprovalList(view, filters);
  const data = resource.status === "ready" ? resource.data : null;
  const filtered = isFiltered(filters, view);

  // Saved IDs that left the reviewer's lists (a removed courier, a depot taken away) stop filtering.
  const options = data?.options;
  useEffect(() => {
    if (!options) return;
    setFilters((f) => {
      const pruned = pruneReviewFilters(f, options);
      return pruned.depotId === f.depotId && pruned.carId === f.carId && pruned.userId === f.userId ? f : pruned;
    });
  }, [options, setFilters]);
  const format = useFormat(data?.firm.timeZone ?? beforeLoad.timeZone, data?.firm.currency ?? beforeLoad.currency);

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-4 pb-8"
      contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 8 : insets.top + 8 }}
      refreshControl={
        data ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} />
        ) : undefined
      }
    >
      <SectionEntrance index={0}>
        <View className="gap-4">
          <View className="flex-row items-start justify-between gap-3">
            <ThemedText variant="heading" accessibilityRole="header" className="flex-1">
              {t("review.title")}
            </ThemedText>
            {data ? <Tag tone="role" size="sm" label={data.firm.name} /> : null}
          </View>
          <SegmentedControl
            options={[
              {
                value: "pending",
                label: data ? t("review.pendingCount", { count: data.pendingCount }) : t("review.pending"),
              },
              { value: "reviewed", label: t("review.reviewed") },
            ]}
            value={view}
            onChange={setView}
          />
          <ReviewFilterBar view={view} filters={filters} options={data?.options ?? null} onChange={setFilters} />
        </View>
      </SectionEntrance>

      {resource.status === "loading" ? (
        <View className="gap-3" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View className="h-14 rounded-md bg-border" />
          <View className="h-14 rounded-md bg-border" />
          <View className="h-14 rounded-md bg-border" />
        </View>
      ) : resource.status === "failed" ? (
        resource.failure === "role" ? (
          <Notice icon="profile" title={t("firm.roleNotYet.title")} body={t("firm.roleNotYet.body")} />
        ) : resource.failure === "firmNotSetUp" ? (
          <Notice icon="settings" title={t("firm.notSetUp.title")} body={t("firm.notSetUp.body")} />
        ) : (
          <View className="gap-3">
            <Alert
              tone={resource.failure === "offline" ? "offline" : "danger"}
              message={resource.failure === "offline" ? t("review.offline") : t("review.error")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
          </View>
        )
      ) : resource.data.items.length === 0 && filtered ? (
        <Notice icon="filter" title={t("review.filters.emptyTitle")} body={t("review.filters.emptyBody")} />
      ) : resource.data.items.length === 0 ? (
        <Notice
          icon={view === "pending" ? "check" : "approvals"}
          title={view === "pending" ? t("review.emptyPendingTitle") : t("review.emptyReviewedTitle")}
          body={view === "pending" ? t("review.emptyPendingBody") : t("review.emptyReviewedBody")}
        />
      ) : (
        <SectionEntrance key={view} index={1}>
          <View className="gap-2">
            {filtered ? (
              <ThemedText variant="footnote" className="px-1">
                {resource.data.total === 1
                  ? t("review.filters.totalOne")
                  : t("review.filters.totalOther", { count: resource.data.total })}
              </ThemedText>
            ) : null}
            <ReviewList items={resource.data.items} format={format} />
          </View>
        </SectionEntrance>
      )}
    </ScrollView>
  );
}
