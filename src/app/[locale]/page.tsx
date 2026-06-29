import Link from "next/link";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { adminGatePath } from "@/lib/links";
import { buttonVariants } from "@/components/ui/button";
import { MobileFrame, ScreenBody } from "@/components/ui/mobile-frame";
import { LogoSymbol } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/domain/types";

// zh 손님 카피는 Phase 3(메시지)에서 채운다. 여기 데모 랜딩은 미정 로케일을 ko 로 폴백.
const COPY: Partial<
  Record<
    Locale,
    { hi: string; sub: string; customer: string; admin: string; note: string }
  >
> = {
  ko: {
    hi: "소통",
    sub: "외국인 손님을 위한 다국어 AI 상담·접수 데스크",
    customer: "손님으로 시작하기",
    admin: "직원용 · 어드민 대시보드",
    note: "손님이 접수하면 담당 디자이너 휴대폰으로 바로 알림이 갑니다.",
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
  const t = COPY[locale as Locale] ?? COPY.ko!;

  return (
    <MobileFrame>
      <ScreenBody className="flex flex-col justify-center gap-8 py-10">
        <div className="space-y-5 text-center">
          <LogoSymbol
            className="animate-logo mx-auto size-16 text-brand"
            title={t.hi}
          />
          <div
            className="animate-rise space-y-2.5"
            style={{ animationDelay: "120ms" }}
          >
            <h1 className="text-3xl font-bold tracking-tight">{t.hi}</h1>
            <p className="mx-auto max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              {t.sub}
            </p>
          </div>
        </div>

        <div
          className="animate-rise space-y-3"
          style={{ animationDelay: "60ms" }}
        >
          {/* 손님 진입 (주 CTA) — 매장/디자이너 QR 스캔으로(살롱 가정 X) */}
          <Link
            href={`/${locale}/scan`}
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
            href={adminGatePath(locale as Locale)}
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
