import { useCallback } from "react";

import { useTranslation } from "@/i18n";

/** A person's name as the server sent it, or "Deleted user" once the account is gone (the server sends ""). */
export function useDisplayName() {
  const { t } = useTranslation();
  return useCallback((name: string) => name || t("people.deletedUser"), [t]);
}
