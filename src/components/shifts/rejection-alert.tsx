import { Alert } from "@/components/alert";
import type { Rejection } from "@/domain/types";
import { useTranslation } from "@/i18n";

/** "Sent back: Kilometers don't match, Wrong bus or station. Check the odometer photo." */
export function useRejectionText(rejection: Rejection | undefined): string | null {
  const { t } = useTranslation();
  if (!rejection) return null;
  const reasons = rejection.reasons.map((r) => t(`review.reasons.${r}`)).join(", ");
  const text = [reasons, rejection.note].filter(Boolean).join(". ");
  return t("home.today.rejected", { reason: text });
}

// Why a dispatcher sent the shift back, as the courier and the dispatcher see it.
export function RejectionAlert({ rejection, className }: { rejection: Rejection | undefined; className?: string }) {
  const text = useRejectionText(rejection);
  return text ? <Alert tone="danger" message={text} className={className} /> : null;
}
