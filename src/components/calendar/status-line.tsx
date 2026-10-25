import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import type { MonthStats } from "@/domain/calendar";
import { useTranslation } from "@/i18n";

// One line above the calendar about the shown month: what needs fixing, what waits, or that all is approved.
export function StatusLine({ stats }: { stats: MonthStats | undefined }) {
  const { t } = useTranslation();
  if (!stats || stats.shifts === 0) return null;
  const text =
    stats.rejected > 0
      ? t("calendar.status.rejected", { count: stats.rejected })
      : stats.submitted > 0
        ? t("calendar.status.waiting", { count: stats.submitted })
        : t("calendar.status.allApproved");
  return (
    <Surface variant="outlined" className="p-4">
      <ThemedText variant="body" color={stats.rejected > 0 ? "danger" : "ink-muted"} className="text-center">
        {text}
      </ThemedText>
    </Surface>
  );
}
