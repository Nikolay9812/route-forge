import { LegalPage } from "@/components/legal-page";
import { useTranslation } from "@/i18n";

// The privacy policy, linked from sign-up, Profile and the store listings.
export default function Privacy() {
  const { t } = useTranslation();
  return <LegalPage title={t("legal.privacy.title")} body={t("legal.privacy.body")} />;
}
