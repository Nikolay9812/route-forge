import { Fragment, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { ActionSheet, type SheetAction } from "@/components/action-sheet";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { Divider } from "@/components/divider";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import {
  emptyReviewFilters,
  isFiltered,
  reviewSorts,
  type ReviewFilters,
  type ReviewOptions,
  type ReviewView,
} from "@/domain/review-filters";
import { useTranslation } from "@/i18n";

type Sheet = "depot" | "courier" | "bus" | "sort";

// Filters for the Approvals list, like the Service log: rows that open a choice sheet (depot, courier, bus, sort),
// then chips (status in Reviewed, missing photos, corrected). Rows wait for the first answer's options.
export function ReviewFilterBar({
  view,
  filters,
  options,
  onChange,
}: {
  view: ReviewView;
  filters: ReviewFilters;
  options: ReviewOptions | null;
  onChange: (update: (filters: ReviewFilters) => ReviewFilters) => void;
}) {
  const { t } = useTranslation();
  // The last sheet stays rendered while it fades out.
  const [sheet, setSheet] = useState<Sheet>("depot");
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<ReviewFilters>) => onChange((f) => ({ ...f, ...patch }));

  const depot = options?.depots.find((d) => d.id === filters.depotId)?.name;
  const courier = options?.couriers.find((c) => c.userId === filters.userId)?.name;
  const bus = options?.buses.find((b) => b.id === filters.carId)?.plate;
  const sortLabel = t("review.filters.sortBy", { by: t(`review.filters.sorts.${filters.sort}`) });

  const rows: { sheet: Sheet; icon: IconName; label: string; value: string; plate?: boolean }[] = [
    { sheet: "depot", icon: "depot", label: t("review.filters.depot"), value: depot ?? t("review.filters.allDepots") },
    { sheet: "courier", icon: "profile", label: t("review.filters.courier"), value: courier ?? t("review.filters.allCouriers") },
    { sheet: "bus", icon: "car", label: t("review.filters.bus"), value: bus ?? t("review.filters.allBuses"), plate: Boolean(bus) },
    { sheet: "sort", icon: "list", label: t("review.filters.sort"), value: sortLabel },
  ];

  const sheets: Record<Sheet, { title: string; actions: SheetAction[] }> = {
    depot: {
      title: t("review.filters.depot"),
      actions: [
        { label: t("review.filters.allDepots"), onPress: () => set({ depotId: null }) },
        ...(options?.depots ?? []).map((d) => ({ label: d.name, onPress: () => set({ depotId: d.id }) })),
      ],
    },
    courier: {
      title: t("review.filters.courier"),
      actions: [
        { label: t("review.filters.allCouriers"), onPress: () => set({ userId: null }) },
        ...(options?.couriers ?? []).map((c) => ({ label: c.name, onPress: () => set({ userId: c.userId }) })),
      ],
    },
    bus: {
      title: t("review.filters.bus"),
      actions: [
        { label: t("review.filters.allBuses"), onPress: () => set({ carId: null }) },
        ...(options?.buses ?? []).map((b) => ({ label: b.plate, onPress: () => set({ carId: b.id }) })),
      ],
    },
    sort: {
      title: t("review.filters.sort"),
      actions: reviewSorts.map((sort) => ({ label: t(`review.filters.sorts.${sort}`), onPress: () => set({ sort }) })),
    },
  };

  return (
    <View className="gap-4">
      <Surface className="overflow-hidden">
        {rows.map((row, i) => (
          <Fragment key={row.sheet}>
            {i > 0 ? <Divider className="mx-4" /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${row.label}, ${row.value}`}
              disabled={!options}
              onPress={() => {
                setSheet(row.sheet);
                setOpen(true);
              }}
              className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
            >
              <Icon name={row.icon} color="ink-muted" />
              <ThemedText
                variant="body"
                color="ink"
                numberOfLines={1}
                className="flex-1"
                style={row.plate ? { fontVariant: ["tabular-nums"] } : undefined}
              >
                {row.value}
              </ThemedText>
              <Icon name="filter" size="sm" color="ink-muted" />
            </Pressable>
          </Fragment>
        ))}
      </Surface>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
        {view === "reviewed" ? (
          <>
            <Chip label={t("review.filters.all")} selected={filters.status === null} onPress={() => set({ status: null })} />
            <Chip label={t("status.approved")} selected={filters.status === "approved"} onPress={() => set({ status: "approved" })} />
            <Chip label={t("status.rejected")} selected={filters.status === "rejected"} onPress={() => set({ status: "rejected" })} />
          </>
        ) : null}
        <Chip
          label={t("review.filters.missingPhotos")}
          icon="camera"
          tone="primary"
          selected={filters.missingPhotos}
          onPress={() => set({ missingPhotos: !filters.missingPhotos })}
        />
        <Chip
          label={t("review.corrected")}
          tone="primary"
          selected={filters.corrected}
          onPress={() => set({ corrected: !filters.corrected })}
        />
      </ScrollView>

      {isFiltered(filters, view) ? (
        <Button
          title={t("review.filters.clear")}
          variant="secondary"
          size="sm"
          onPress={() => onChange((f) => ({ ...emptyReviewFilters, sort: f.sort }))}
        />
      ) : null}

      <ActionSheet
        visible={open}
        title={sheets[sheet].title}
        actions={sheets[sheet].actions}
        cancelLabel={t("fleet.cancel")}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
