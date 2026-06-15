"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { reportClientError } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { MobileFrame, ScreenBody } from "@/components/ui/mobile-frame";

/**
 * 전역 클라이언트 에러 바운더리 — 크래시를 어드민 "발생 에러" 로그로 흘려보낸다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Common");

  useEffect(() => {
    void reportClientError({
      message: error.message || "Unhandled client error",
      detail: error.stack ?? error.digest,
      source: "client",
    });
  }, [error]);

  return (
    <MobileFrame>
      <ScreenBody className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{t("errorTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("errorGeneric")}</p>
        </div>
        <Button variant="accent" onClick={reset}>
          {t("retry")}
        </Button>
      </ScreenBody>
    </MobileFrame>
  );
}
