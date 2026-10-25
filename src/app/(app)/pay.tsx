import { TabPlaceholder } from "@/components/tab-placeholder";
import { useTranslation } from "@/i18n";

// Placeholder until the pay plan.
export default function Pay() {
  const { t } = useTranslation();
  return <TabPlaceholder icon="salary" title={t("placeholder.pay.title")} body={t("placeholder.pay.body")} />;
}
