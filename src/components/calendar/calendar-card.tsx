import { Fragment, useMemo, useState, type ReactNode } from "react";
import { PanResponder, Pressable, View } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { clock, type useFormat } from "@/components/home/format";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { CalendarState } from "@/calendar/use-calendar";
import { addMonths, monthGrid, monthsBetween } from "@/domain/calendar";
import { monthOf } from "@/domain/dates";
import type { CalendarMonth, Shift, ShiftStatus } from "@/domain/types";
import { useTranslation } from "@/i18n";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// Opacity only, so reduced motion needs nothing different.
const monthFade = FadeIn.duration(180).easing(EASE_OUT);
const SWIPE_DISTANCE = 50;

// Literal classes per status so Tailwind sees each one. Draft (today's shift in progress) is an outline like today.
const marks: Record<ShiftStatus, { circle: string; number: "on-inverse" | "on-primary" | "white" | "ink" }> = {
  approved: { circle: "bg-secondary-ink", number: "on-inverse" },
  submitted: { circle: "bg-primary", number: "on-primary" },
  rejected: { circle: "bg-danger", number: "white" },
  draft: { circle: "border-2 border-secondary-ink", number: "ink" },
};

type Format = ReturnType<typeof useFormat>;

// Design: a month of one courier's shifts. Header (month, List/Calendar), the month's stats, then the Monday-first
// grid or a list. Chevrons, dots and a horizontal swipe page between months.
export function CalendarCard({
  state,
  format,
  onOpenShift,
}: {
  state: CalendarState<CalendarMonth>;
  format: Format;
  onOpenShift: (shift: Shift) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  const { month, data, latest } = state;
  if (!month || !latest) return null;
  const today = latest.today;
  const stats = data?.stats;

  return (
    <Surface variant="outlined">
      <View className="flex-row items-center gap-3 px-4 py-4">
        <Icon name="review" />
        <ThemedText variant="title" accessibilityRole="header" className="flex-1" numberOfLines={1}>
          {format.calendarMonth(`${month}-01`, today)}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setMode((m) => (m === "calendar" ? "list" : "calendar"))}
        >
          <ThemedText variant="body" color="secondary-ink">
            {mode === "calendar" ? t("calendar.list") : t("calendar.calendar")}
          </ThemedText>
        </Pressable>
      </View>
      <Divider />

      <View className="flex-row gap-3 px-4 py-4">
        <Stat label={t("calendar.stats.shifts")} value={stats ? String(stats.shifts) : "–"} />
        <Stat label={t("calendar.stats.hours")} value={stats ? clock(stats.minutes) : "–"} />
        <Stat label={t("calendar.stats.approved")} value={stats ? clock(stats.approvedMinutes) : "–"} />
      </View>
      <Divider />

      <Swipe onPrev={state.canPrev ? state.prev : undefined} onNext={state.canNext ? state.next : undefined}>
        {data ? (
          <Animated.View key={month} entering={monthFade}>
            {mode === "calendar" ? (
              <MonthGrid data={data} format={format} onOpenShift={onOpenShift} />
            ) : (
              <MonthList shifts={data.shifts} format={format} onOpenShift={onOpenShift} />
            )}
          </Animated.View>
        ) : state.failure ? (
          <View className="gap-3 p-4">
            <Alert
              tone={state.failure === "offline" ? "offline" : "danger"}
              message={state.failure === "offline" ? t("calendar.offline") : t("calendar.error")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={state.retry} />
          </View>
        ) : (
          <View className="h-80 p-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View className="flex-1 rounded-md bg-border" />
          </View>
        )}
        <Pager state={state} />
      </Swipe>
    </Surface>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-1">
      <ThemedText variant="body" color="ink" numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </ThemedText>
      <ThemedText variant="body" color="ink" style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Horizontal swipes page months; vertical drags stay with the screen's scroll view. */
export function Swipe({ onPrev, onNext, children }: { onPrev?: () => void; onNext?: () => void; children: ReactNode }) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -SWIPE_DISTANCE) onNext?.();
          else if (g.dx >= SWIPE_DISTANCE) onPrev?.();
        },
      }),
    [onPrev, onNext],
  );
  return <View {...responder.panHandlers}>{children}</View>;
}

function MonthGrid({ data, format, onOpenShift }: { data: CalendarMonth; format: Format; onOpenShift: (shift: Shift) => void }) {
  const { t } = useTranslation();
  const weeks = useMemo(() => monthGrid(data.month), [data.month]);
  const byDate = useMemo(() => new Map(data.shifts.map((s) => [s.date, s])), [data.shifts]);

  return (
    <View className="px-4 pt-4">
      <View className="flex-row pb-3">
        {weeks[0].map(({ date }) => (
          <ThemedText key={date} variant="body" color="ink-muted" className="flex-1 text-center">
            {format.weekday(date)}
          </ThemedText>
        ))}
      </View>
      <View className="gap-3">
        {weeks.map((week) => (
          <View key={week[0].date} className="flex-row overflow-hidden rounded-md border border-border">
            {week.map(({ date, inMonth }, i) => {
              const shift = inMonth ? byDate.get(date) : undefined;
              const mark = shift ? marks[shift.status] : inMonth && date === data.today ? marks.draft : null;
              const day = (
                <View className={`size-8 items-center justify-center rounded-full ${mark?.circle ?? ""}`}>
                  <ThemedText
                    variant="body"
                    color={!inMonth ? "ink-muted" : (mark?.number ?? "ink")}
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {Number(date.slice(8))}
                  </ThemedText>
                </View>
              );
              const cell = `h-13 flex-1 items-center justify-center ${i > 0 ? "border-l border-border" : ""} ${
                inMonth ? "bg-surface" : "bg-canvas"
              }`;
              return shift ? (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={t("calendar.day", {
                    day: format.longDay(date),
                    status: t(`status.${shift.status}`),
                  })}
                  onPress={() => onOpenShift(shift)}
                  className={`${cell} active:bg-secondary-soft`}
                >
                  {day}
                </Pressable>
              ) : (
                <View key={date} className={cell}>
                  {day}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Legend />
    </View>
  );
}

function Legend() {
  const { t } = useTranslation();
  const items: { dot: string; label: string }[] = [
    { dot: "bg-secondary-ink", label: t("calendar.legend.approved") },
    { dot: "bg-primary", label: t("calendar.legend.submitted") },
    { dot: "bg-danger", label: t("calendar.legend.rejected") },
    { dot: "border-2 border-secondary-ink", label: t("calendar.legend.today") },
  ];
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-2 pt-3">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-1.5">
          <View className={`size-2.5 rounded-full ${item.dot}`} />
          <ThemedText variant="footnote">{item.label}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function MonthList({ shifts, format, onOpenShift }: { shifts: Shift[]; format: Format; onOpenShift: (shift: Shift) => void }) {
  const { t } = useTranslation();
  if (shifts.length === 0) {
    return (
      <ThemedText variant="body" color="ink-muted" className="py-8 text-center">
        {t("calendar.empty")}
      </ThemedText>
    );
  }
  return (
    <View>
      {shifts.map((shift, i) => (
        <Fragment key={shift.id}>
          {i > 0 ? <Divider className="mx-4" /> : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpenShift(shift)}
            className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
          >
            <ThemedText variant="body" color="ink" className="flex-1" numberOfLines={1}>
              {format.shortDay(shift.date)}
            </ThemedText>
            <ThemedText variant="body" color="ink-muted" style={{ fontVariant: ["tabular-nums"] }}>
              {shift.minutes === null ? "–" : clock(shift.minutes)}
            </ThemedText>
            <Tag tone={shift.status} size="sm" label={t(`status.${shift.status}`)} />
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

function Pager({ state }: { state: CalendarState<CalendarMonth> }) {
  const { t } = useTranslation();
  const current = monthOf(state.latest!.today);
  const recent = monthsBetween(addMonths(current, -4), current);
  return (
    <View className="flex-row items-center justify-between px-2 pt-6 pb-2">
      <Chevron icon="back" label={t("calendar.previous")} disabled={!state.canPrev} onPress={state.prev} />
      <View className="flex-row gap-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {recent.map((m) => (
          <View key={m} className={`size-2.5 rounded-full ${m === state.month ? "bg-secondary-ink" : "bg-border"}`} />
        ))}
      </View>
      <Chevron icon="chevron" label={t("calendar.next")} disabled={!state.canNext} onPress={state.next} />
    </View>
  );
}

export function Chevron({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="size-ghost items-center justify-center rounded-full active:bg-canvas disabled:opacity-40"
    >
      <Icon name={icon} />
    </Pressable>
  );
}
