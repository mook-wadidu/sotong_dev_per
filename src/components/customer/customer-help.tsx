"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui";

/**
 * 손님 진입(C1) '어떻게 진행되나요?' — 짧은 3단계 안내 Sheet.
 * 손님은 자기 언어로 보므로 useTranslations("Customer").help.* (로케일별).
 * 진입 화면을 깨끗하게 유지하려 기본 접힘, 텍스트 링크로만 노출.
 */
export function CustomerHelp() {
  const t = useTranslations("Customer");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = React.useState(false);

  const steps = [t("help.step1"), t("help.step2"), t("help.step3")];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-accent-text underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t("help.trigger")}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent closeLabel={tCommon("close")}>
          <SheetHeader>
            <SheetTitle>{t("help.title")}</SheetTitle>
            <SheetDescription>{t("help.subtitle")}</SheetDescription>
          </SheetHeader>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-text">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed text-foreground">
                  {s}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t("help.consent")}
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
