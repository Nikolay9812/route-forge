import { useLocalSearchParams } from "expo-router";

import { ServiceLog } from "@/components/car-notes/service-log";

// The owner's service log: every note mechanics (and the owner) wrote, filtered by car and type.
export default function ServiceLogScreen() {
  const { carId } = useLocalSearchParams<{ carId?: string }>();
  return <ServiceLog stack="profile" initialCarId={carId} />;
}
