import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";

import { useCalendar } from "@/calendar/use-calendar";
import { CalendarSection } from "@/components/calendar/calendar-section";
import { useDisplayName } from "@/people/display-name";
import type { CourierCalendarMonth } from "@/team/team";

// One courier's month calendar for a dispatcher (their depots only) or owner. Tapping a day opens its review.
export default function TeamCourier() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const calendar = useCalendar<CourierCalendarMonth>(`/api/team/${encodeURIComponent(userId)}`);
  const displayName = useDisplayName();

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 p-4 pb-8"
    >
      <Stack.Screen options={{ title: calendar.latest ? displayName(calendar.latest.courierName) : (name ?? "") }} />
      <CalendarSection
        state={calendar}
        onOpenShift={(s) => router.push({ pathname: "/team/shift/[id]", params: { id: s.id } })}
      />
    </ScrollView>
  );
}
