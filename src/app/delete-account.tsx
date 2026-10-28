import { LegalPage } from "@/components/legal-page";
import { useTranslation } from "@/i18n";

// How to delete an account, for Google Play's web link. The deleting itself happens in the app (Profile).
export default function DeleteAccount() {
  const { t } = useTranslation();
  return <LegalPage title={t("legal.deleteAccount.title")} body={t("legal.deleteAccount.body")} />;
}
