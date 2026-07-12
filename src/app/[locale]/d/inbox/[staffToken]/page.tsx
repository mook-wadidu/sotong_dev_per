import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getDesignerInbox, recordStaffTokenSeen } from "@/lib/service";
import { shareOrigin } from "@/lib/origin";
import { MobileFrame, ScreenHeader, ScreenBody } from "@/components/ui";
import { DesignerInboxView } from "@/components/designer/designer-inbox-view";

/**
 * 인박스별 매니페스트 링크 — '홈 화면에 추가'로 만든 PWA 가 이 인박스로 열리게 한다
 * (전역 매니페스트의 start_url=/ko 덮어쓰기). iOS 16.4+ 가 start_url 을 사용.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; staffToken: string }>;
}) {
  const { locale, staffToken } = await params;
  return {
    manifest: `/${locale}/d/inbox/${staffToken}/manifest.webmanifest`,
  };
}

/**
 * D1 — 디자이너 개인 인박스 (디자이너 staffToken).
 * 서버 컴포넌트: getDesignerInbox(staffToken) → null 이면 안내.
 * '내 손님'(mine) + '미배정'(unassigned, 각 항목에 '내 손님으로 가져오기').
 * 디자이너 뷰 = ko 고정.
 */
export default async function DesignerInboxPage({
  params,
}: {
  params: Promise<{ locale: string; staffToken: string }>;
}) {
  const { locale, staffToken } = await params;
  const t = await getTranslations("Designer");
  const h = await headers();
  const data = await getDesignerInbox(staffToken);

  if (!data) {
    return (
      <MobileFrame tone="muted">
        <ScreenHeader title={t("inbox.title")} />
        <ScreenBody className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">{t("inbox.invalid")}</p>
          <Link
            href={`/${locale}/d`}
            className="text-sm font-semibold text-brand-text underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("login.retry")}
          </Link>
        </ScreenBody>
      </MobileFrame>
    );
  }

  // 디자이너가 자기 인박스를 연 실제 진입점 — last_seen 기록(유출 감지, 토큰 URL 진입).
  recordStaffTokenSeen(data.designer.id, h.get("x-real-ip"));
  const origin = shareOrigin(h.get("host"), h.get("x-forwarded-proto") ?? "http");

  return (
    <DesignerInboxView data={data} staffToken={staffToken} origin={origin} />
  );
}
