import type { Bus, Station } from "@/domain/types";
import { useTranslation } from "@/i18n";

import { ChoiceChips } from "./choice-chips";

// Station and bus chips, shared by the start card, the route card and the edit form.
export function StationBusPickers({
  stationId,
  busId,
  stations,
  buses,
  onChange,
}: {
  stationId: string | null;
  busId: string | null;
  stations: Station[];
  buses: Bus[];
  onChange: (change: { stationId: string } | { busId: string }) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ChoiceChips
        label={t("shifts.fields.station")}
        icon="depot"
        options={stations.map((s) => ({ id: s.id, label: s.name }))}
        selected={stationId}
        onSelect={(id) => onChange({ stationId: id })}
      />
      <ChoiceChips
        label={t("shifts.fields.bus")}
        icon="car"
        options={buses.map((b) => ({ id: b.id, label: b.plate }))}
        selected={busId}
        onSelect={(id) => onChange({ busId: id })}
      />
    </>
  );
}
