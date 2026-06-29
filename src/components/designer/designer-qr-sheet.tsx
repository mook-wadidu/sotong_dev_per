"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui";
import { SalonQR } from "@/components/admin/salon-qr";

/**
 * 디자이너 인박스 '내 QR' — 손님에게 바로 보여주는 디자이너 개인 입장 QR.
 * 손님이 스캔하면 토큰에 designerId 가 박혀 있어 이 디자이너에게 자동 배정된다.
 * 절대 URL(entryUrl)·entryPath 는 서버(인박스 페이지)가 요청 Host 로 만들어 넘긴다.
 * 디자이너 뷰(ko 고정) — useTranslations("Designer").qr.* + 기존 SalonQR 재사용.
 */
export function DesignerQrSheet({
  entryUrl,
  entryPath,
  salonName,
}: {
  entryUrl: string;
  entryPath: string;
  salonName: string;
}) {
  const t = useTranslations("Designer");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {t("qr.button")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent closeLabel={tCommon("close")}>
          <SheetHeader>
            <SheetTitle>{t("qr.title")}</SheetTitle>
            <SheetDescription>{t("qr.hint")}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <SalonQR
              entryUrl={entryUrl}
              entryPath={entryPath}
              salonName={salonName}
              labels={{
                copy: t("qr.copy"),
                copied: t("qr.copied"),
                print: t("qr.print"),
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
