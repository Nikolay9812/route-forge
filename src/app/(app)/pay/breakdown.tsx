import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFormat } from "@/components/home/format";
import { BreakdownTable } from "@/components/pay/breakdown-table";
import { breakdownKinds, type BreakdownKind } from "@/components/pay/month-summary";
import { usePayMonth } from "@/pay/pay-month";

const isKind = (value: unknown): value is BreakdownKind => breakdownKinds.includes(value as BreakdownKind);

// The shown month's day-by-day table for one measure, from the Pay screen's already loaded month. A day opens
// that shift on the Shifts tab.
export default function Breakdown() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const { data } = usePayMonth();
  const insets = useSafeAreaInsets();
  const format = useFormat(data?.firm.timeZone ?? "UTC", data?.firm.currency ?? "EUR");
  const valid = isKind(kind) && data !== null;

  useEffect(() => {
    if (!valid) router.back();
  }, [valid]);
  if (!valid) return null;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="px-6 pt-8"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      nestedScrollEnabled
    >
      <BreakdownTable
        kind={kind}
        data={data}
        format={format}
        onOpenDay={(day) => {
          router.back();
          router.navigate({ pathname: "/shifts/[id]", params: { id: day.shiftId } });
        }}
      />
    </ScrollView>
  );
}
