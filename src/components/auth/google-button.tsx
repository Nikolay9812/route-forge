import { Image } from "expo-image";
import { useState } from "react";

import { useSignIn, type AuthError } from "@/auth";
import { Button } from "@/components/button";
import { useTranslation } from "@/i18n";

// Google's official "G" mark, see assets/images/auth/CREDITS.md.
const googleMark = require("@/assets/images/auth/google-g.png");

export function GoogleButton({ disabled, onError }: { disabled?: boolean; onError: (error: AuthError) => void }) {
  const { t } = useTranslation();
  const { signIn } = useSignIn();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      title={t("auth.continueWithGoogle")}
      variant="secondary"
      size="social"
      leading={<Image source={googleMark} style={{ width: 20, height: 20 }} accessible={false} />}
      loading={loading}
      disabled={disabled}
      onPress={async () => {
        setLoading(true);
        const { error } = await signIn.sso({ strategy: "oauth_google" });
        setLoading(false);
        if (error) onError(error);
      }}
    />
  );
}
