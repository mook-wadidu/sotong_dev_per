import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MobileFrame, ScreenBody, ScreenHeader } from "@/components/ui";

/**
 * 개인정보 처리방침 — 인테이크 동의문에서 새 탭으로 링크.
 *
 * 내용은 **코드가 실제로 하는 처리**에 맞춰 작성했다(데이터 인벤토리 감사 기반):
 * 수집 항목·90일 파기 대상과 잔존 항목의 구분·국외이전 실태(Gemini 미국 / Supabase 호주 /
 * Vercel 미국)·민감정보 별도동의·가명정보(익명 아님)·쿠키·권리 행사방법.
 *
 * **noindex 유지** — 법무 검토 및 사업자/보호책임자 정보 확정 전까지 검색 비노출.
 * 확정 시 robots 를 index 로 바꾸고 draftNotice 를 제거할 것.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Customer" });
  return {
    title: t("privacy.title"),
    robots: { index: false, follow: false },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Customer" });

  // PIPA §30 필수기재 순서. 각 항목은 i18n(privacy.*) 에서 4개국어로 관리.
  const sections: { h: string; b: string }[] = [
    { h: t("privacy.controllerH"), b: t("privacy.controllerB") },
    { h: t("privacy.purposeH"), b: t("privacy.purposeB") },
    { h: t("privacy.itemsH"), b: t("privacy.itemsB") },
    { h: t("privacy.sensitiveH"), b: t("privacy.sensitiveB") },
    { h: t("privacy.retentionH"), b: t("privacy.retentionB") },
    { h: t("privacy.thirdH"), b: t("privacy.thirdB") },
    { h: t("privacy.pseudoH"), b: t("privacy.pseudoB") },
    { h: t("privacy.cookieH"), b: t("privacy.cookieB") },
    { h: t("privacy.rightsH"), b: t("privacy.rightsB") },
    { h: t("privacy.securityH"), b: t("privacy.securityB") },
    { h: t("privacy.cpoH"), b: t("privacy.cpoB") },
    { h: t("privacy.changesH"), b: t("privacy.changesB") },
  ];

  return (
    <MobileFrame tone="muted">
      <ScreenHeader title={t("privacy.title")} />
      <ScreenBody className="space-y-6 py-6">
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {t("privacy.draftNotice")}
        </p>
        <p className="text-sm leading-relaxed text-foreground">
          {t("privacy.intro")}
        </p>

        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.h} className="space-y-1.5">
              <h2 className="text-sm font-semibold text-foreground">{s.h}</h2>
              {/* 본문에 목록형 줄바꿈(\n)이 있어 whitespace-pre-line 로 보존. */}
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {s.b}
              </p>
            </section>
          ))}
        </div>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {t("privacy.effective")}
        </p>
      </ScreenBody>
    </MobileFrame>
  );
}
