import { getTranslations } from "next-intl/server";
import { getSalonByEntry } from "@/lib/actions";
import { trackEvent } from "@/lib/track";
import { tx, type Locale } from "@/lib/domain/types";
import { MobileFrame, ScreenBody } from "@/components/ui";
import { InvalidEntry } from "@/components/customer/invalid-entry";
import { LanguageChoices } from "@/components/customer/language-choices";
import { CustomerHelp } from "@/components/customer/customer-help";
import { LogoSymbol } from "@/components/brand/logo";
import { AnnouncementBanner } from "@/components/announcement-banner";

export default async function CustomerEntryPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const { salon, designer } = await getSalonByEntry(token);
  const t = await getTranslations({ locale, namespace: "Customer" });

  if (!salon) {
    return <InvalidEntry kind="entry" />;
  }

  await trackEvent("scan", { salonSlug: salon.slug, locale }); // QR 진입(유효 살롱만)

  const loc = locale as Locale;

  // 디자이너 직급 라벨(다국어) — 있으면 "이름 · 직급"을 손님 언어로 표시한다.
  // rankLabel 없으면(미배정/직급 미설정) 이름만 표시(현행).
  const designerRank = designer?.rankLabel
    ? tx(designer.rankLabel, loc)
    : null;

  return (
    <MobileFrame tone="muted">
      <ScreenBody className="flex min-h-dvh flex-col justify-center gap-8 py-10">
        {/* 살롱 공지(있으면) */}
        <AnnouncementBanner
          audiences={["customer"]}
          salonSlug={salon.slug}
          locale={loc}
        />
        {/* 지점명 없음(의도) — 파일럿은 살롱을 정해놓고 시작하지 않는다. 진입 화면은
            브랜드 로고 + 언어 선택만(손님 소속 지점을 단정하지 않음). designer 는 살롱 QR
            진입 시 null 이라 파일럿에선 표시되지 않음. */}
        <div className="animate-rise space-y-3 text-center">
          <LogoSymbol className="animate-logo mx-auto size-11 text-brand" />
          {designer ? (
            <p className="text-sm font-medium text-accent-text">
              {designer.name}
              {designerRank ? (
                <span className="text-muted-foreground">
                  {t("entry.designerRankSeparator")}
                  {designerRank}
                </span>
              ) : null}
            </p>
          ) : null}
          <h1 className="mx-auto max-w-xs text-pretty text-lg font-bold leading-snug text-foreground">
            {t("langSelect.title")}
          </h1>
        </div>

        {/* 언어 선택 */}
        <div className="animate-rise" style={{ animationDelay: "60ms" }}>
          <LanguageChoices entryToken={token} />
        </div>

        {/* 안심 카피 — 설치/로그인 불필요 + 진행 안내 */}
        <div className="animate-fade flex flex-col items-center gap-2 px-2 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("langSelect.reassure")}
          </p>
          <CustomerHelp />
        </div>
      </ScreenBody>
    </MobileFrame>
  );
}
