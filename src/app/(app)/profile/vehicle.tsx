import { useLocalSearchParams } from "expo-router";

import { CarScreen } from "@/components/fleet/car-papers";

// One of the owner's cars with its papers and talon photo.
export default function Vehicle() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <CarScreen id={id} />;
}
