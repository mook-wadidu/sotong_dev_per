import { getTranslations } from "next-intl/server";
import { MobileFrame } from "@/components/ui";
import { QrScanScreen } from "@/components/customer/qr-scan-screen";

/**
 * 손님 QR 스캔 화면 — 홈 "손님으로 시작하기"에서 진입.
 * 매장/디자이너 QR(= /c/e/<토큰>)을 카메라로 읽어 해당 매장 입장으로 이동.
 * 라벨은 서버에서 받아 클라 컴포넌트에 props 로 넘긴다(앱 관례).
 */
export default async function ScanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Customer" });

  return (
    <MobileFrame tone="muted">
      <QrScanScreen
        homeHref={`/${locale}`}
        labels={{
          title: t("scan.title"),
          hint: t("scan.hint"),
          preparing: t("scan.preparing"),
          denied: t("scan.denied"),
          error: t("scan.error"),
          retry: t("scan.retry"),
          back: t("scan.back"),
        }}
      />
    </MobileFrame>
  );
}
