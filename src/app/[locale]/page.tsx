import Link from "next/link";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { config } from "@/lib/config";
import { makeSalonEntryToken } from "@/lib/entry";
import { getSalonInfo } from "@/lib/service";
import { customerEntryPath, adminPath } from "@/lib/links";
import { buttonVariants } from "@/components/ui/button";
import { MobileFrame, ScreenBody } from "@/components/ui/mobile-frame";
import { GlobeIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/domain/types";

const COPY: Record<
  Locale,
  { hi: string; sub: string; customer: string; admin: string; note: string }
> = {
  ko: {
    hi: "소통",
    sub: "외국인 손님을 위한 다국어 AI 상담·접수 데스크",
    customer: "손님으로 시작하기",
    admin: "직원용 · 어드민 대시보드",
    note: "손님이 접수하면 디자이너에게 카톡으로 요약 링크가 전달됩니다.",
  },
  ja: {
    hi: "Sotong",
    sub: "外国人のお客様のための多言語AI受付・カウンセリング",
    customer: "お客様としてはじめる",
    admin: "スタッフ用 · 管理ダッシュボード",
    note: "受付が完了すると、デザイナーに要約リンクが届きます。",
  },
  en: {
    hi: "Sotong",
    sub: "A multilingual AI reception desk for foreign salon guests",
    customer: "Start as a guest",
    admin: "Staff · Admin dashboard",
    note: "After intake, the designer receives a summary link.",
  },
};

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = COPY[locale as Locale];

  // 데모 손님 진입: 추측 가능한 slug 대신 서명된 살롱 공용(지정없음) 입장 토큰으로.
  // 살롱의 현재 entryKeyVersion 으로 발급해야 키 회전 후에도 진입이 유효(P1).
  const demoSalon = await getSalonInfo(config.demoSalonSlug);
  const demoEntryToken = makeSalonEntryToken(
    config.demoSalonSlug,
    demoSalon?.entryKeyVersion ?? 1,
  );

  return (
    <MobileFrame>
      <ScreenBody className="flex flex-col justify-center gap-8 py-10">
        <div className="animate-rise space-y-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <GlobeIcon className="size-3.5" />
            AI Reception
          </span>
          <h1 className="text-4xl font-bold tracking-tight">{t.hi}</h1>
          <p className="mx-auto max-w-xs text-pretty text-sm text-muted-foreground">
            {t.sub}
          </p>
        </div>

        <div
          className="animate-rise space-y-3"
          style={{ animationDelay: "60ms" }}
        >
          {/* 손님 진입 (주 CTA) */}
          <Link
            href={customerEntryPath(demoEntryToken, locale as Locale)}
            className={cn(
              buttonVariants({ variant: "accent", size: "xl" }),
              "w-full",
            )}
          >
            {t.customer}
          </Link>

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {t.note}
          </p>
        </div>

        {/* 직원/운영자 진입 (부차적, 손님 혼란 방지 위해 약하게) */}
        <div className="animate-fade text-center">
          <Link
            href={adminPath(config.adminToken)}
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "text-muted-foreground hover:text-accent-text",
            )}
          >
            {t.admin}
          </Link>
        </div>
      </ScreenBody>
    </MobileFrame>
  );
}
