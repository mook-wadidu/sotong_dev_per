import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MobileFrame, ScreenBody, ScreenHeader } from "@/components/ui";

/**
 * 개인정보 처리방침 — 인테이크 동의문에서 새 탭으로 링크(A6).
 * noindex(검색 비노출) + 초안 배너. 실제 본문은 법무 검토 후 확정(현재는 앱의 실제 처리 반영 초안).
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

  const sections: { h: string; b: string }[] = [
    { h: t("privacy.collectH"), b: t("privacy.collectB") },
    { h: t("privacy.useH"), b: t("privacy.useB") },
    { h: t("privacy.aiH"), b: t("privacy.aiB") },
    { h: t("privacy.retentionH"), b: t("privacy.retentionB") },
    { h: t("privacy.trainingH"), b: t("privacy.trainingB") },
    { h: t("privacy.rightsH"), b: t("privacy.rightsB") },
    { h: t("privacy.contactH"), b: t("privacy.contactB") },
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
        <div className="space-y-5">
          {sections.map((s) => (
            <section key={s.h} className="space-y-1.5">
              <h2 className="text-sm font-semibold text-foreground">{s.h}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {s.b}
              </p>
            </section>
          ))}
        </div>
      </ScreenBody>
    </MobileFrame>
  );
}
