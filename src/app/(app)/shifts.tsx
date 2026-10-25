import { TabPlaceholder } from "@/components/tab-placeholder";
import { useTranslation } from "@/i18n";

// Placeholder until the shifts plan.
export default function Shifts() {
  const { t } = useTranslation();
  return <TabPlaceholder icon="shifts" title={t("placeholder.shifts.title")} body={t("placeholder.shifts.body")} />;
}
