import { useLocalSearchParams } from "expo-router";

import { ServiceLog } from "@/components/car-notes/service-log";

// The service log, opened from a car with that car picked.
export default function Log() {
  const { carId } = useLocalSearchParams<{ carId?: string }>();
  return <ServiceLog stack="cars" initialCarId={carId} />;
}
