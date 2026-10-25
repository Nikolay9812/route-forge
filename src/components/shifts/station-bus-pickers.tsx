import type { Bus, Station } from "@/domain/types";
import { useTranslation } from "@/i18n";
import type { ShiftFields } from "@/shifts/draft";

import { ChoiceChips } from "./choice-chips";

// Station and bus chips, shared by the start card and the route card.
export function StationBusPickers({
  fields,
  stations,
  buses,
  onChange,
}: {
  fields: ShiftFields;
  stations: Station[];
  buses: Bus[];
  onChange: (fields: Partial<ShiftFields>) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ChoiceChips
        label={t("shifts.fields.station")}
        icon="depot"
        options={stations.map((s) => ({ id: s.id, label: s.name }))}
        selected={fields.stationId}
        onSelect={(stationId) => onChange({ stationId })}
      />
      <ChoiceChips
        label={t("shifts.fields.bus")}
        icon="car"
        options={buses.map((b) => ({ id: b.id, label: b.plate }))}
        selected={fields.busId}
        onSelect={(busId) => onChange({ busId })}
      />
    </>
  );
}
