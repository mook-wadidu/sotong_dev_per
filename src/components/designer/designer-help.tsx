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

/**
 * 디자이너 인박스 '사용법' — 현장에서 바로 보는 도움말 Sheet.
 * 알림 켜기(현장 최대 마찰), 매일 흐름, 사진 2장 필수를 한 화면에.
 * 디자이너 뷰(ko 고정)이므로 useTranslations("Designer").help.* 를 쓴다.
 */
function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function DesignerHelp() {
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
        {t("help.button")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent closeLabel={tCommon("close")}>
          <SheetHeader>
            <SheetTitle>{t("help.title")}</SheetTitle>
            <SheetDescription>{t("help.subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Block title={t("help.notifyTitle")} body={t("help.notifyBody")} />
            <Block title={t("help.flowTitle")} body={t("help.flowBody")} />
            <Block title={t("help.photoTitle")} body={t("help.photoBody")} />
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs leading-relaxed text-accent-text">
              {t("help.tip")}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
