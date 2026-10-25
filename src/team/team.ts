// Data for the dispatcher's and owner's Team tab: the couriers they may see, with this month's totals.
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

import { useResource } from "@/api/use-resource";
import type { CalendarMonth, Firm } from "@/domain/types";

export type TeamMember = { userId: string; name: string; shifts: number; minutes: number; waiting: number };

export type TeamList = { firm: Firm; today: string; couriers: TeamMember[] };

export type CourierCalendarMonth = CalendarMonth & { courierName: string };

/** The team list, reloaded quietly whenever the tab comes back into focus (not on its first focus). */
export function useTeam() {
  const team = useResource<TeamList>("/api/team");
  const { reload } = team;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );
  return team;
}
