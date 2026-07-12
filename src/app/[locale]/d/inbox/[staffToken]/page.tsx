import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getDesignerInbox, recordStaffTokenSeen } from "@/lib/service";
import { makeDesignerEntryToken } from "@/lib/entry";
import { customerEntryPath } from "@/lib/links";
import { shareOrigin } from "@/lib/origin";
import {
  MobileFrame,
  ScreenHeader,
  ScreenBody,
  SectionLabel,
} from "@/components/ui";
import { ConsultationListItem } from "@/components/designer/consultation-list-item";
import { AssignButton } from "@/components/designer/assign-button";
import { NotificationSetup } from "@/components/designer/notification-setup";
import { InboxRefresh } from "@/components/designer/inbox-refresh";
import { DesignerHelp } from "@/components/designer/designer-help";
import { DesignerQrSheet } from "@/components/designer/designer-qr-sheet";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { config } from "@/lib/config";
import type {
  ConsultationListItem as Item,
} from "@/lib/db/types";
import type { ConsultationStatus } from "@/lib/domain/types";

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

  const { designer, salon, mine, unassigned } = data;

  // 디자이너가 자기 인박스를 연 실제 진입점 — last_seen 기록(유출 감지). x-real-ip = 위조 불가 헤더만(없으면 null).
  recordStaffTokenSeen(designer.id, h.get("x-real-ip"));

  // '내 QR' — 디자이너 개인 입장 QR(손님 스캔 시 이 디자이너에게 배정).
  // 절대 URL — 운영 정식 도메인 우선(보호된 프리뷰 호스트 인코딩 방지), 없으면 요청 Host.
  const origin = shareOrigin(h.get("host"), h.get("x-forwarded-proto") ?? "http");
  const myEntryPath = customerEntryPath(
    makeDesignerEntryToken(designer.id, designer.entryKeyVersion),
  );
  const myEntryUrl = origin ? origin + myEntryPath : myEntryPath;

  // ko 고정 라벨 매핑 (색만으로 의미 전달 금지)
  // Phase 2: 대기(intake·consulting) / 진행중(in_service) / 완료(completed)로 단순화.
  const statusLabel = (status: ConsultationStatus): string => {
    switch (status) {
      case "intake":
      case "consulting":
        return t("inbox.waiting");
      case "in_service":
        return t("inbox.inService");
      case "completed":
        return t("inbox.completed");
      default:
        return t("inbox.waiting");
    }
  };

  const renderItem = (item: Item) => (
    <ConsultationListItem
      item={item}
      statusLabel={statusLabel}
      visitLabel={item.isReturning ? t("inbox.returning") : t("inbox.new")}
    />
  );

  return (
    <MobileFrame tone="muted">
      <ScreenHeader
        title={salon.name}
        subtitle={designer.name}
        trailing={
          <div className="flex items-center gap-1">
            <DesignerQrSheet
              entryUrl={myEntryUrl}
              entryPath={myEntryPath}
              salonName={`${salon.name} · ${designer.name}`}
            />
            <DesignerHelp />
            <InboxRefresh
              label={t("inbox.refresh")}
              refreshingLabel={t("inbox.refreshing")}
            />
          </div>
        }
      />
      <ScreenBody className="space-y-5">
        {/* 살롱 공지(있으면) — 디자이너 뷰 ko 고정 */}
        <AnnouncementBanner
          audiences={["salon", "platform"]}
          salonSlug={salon.slug}
          locale="ko"
        />
        {/* 웹푸시 알림 설정 (PWA) */}
        <NotificationSetup
          staffToken={staffToken}
          vapidPublicKey={config.vapidPublicKey}
        />

        {/* 내 손님 */}
        <section className="space-y-2.5">
          <SectionLabel>{t("inbox.mineTitle")}</SectionLabel>
          {mine.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("inbox.empty")}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {mine.map((item) => (
                <li key={item.id}>{renderItem(item)}</li>
              ))}
            </ul>
          )}
        </section>

        {/* 미배정 (살롱 공용 QR 진입) */}
        <section className="space-y-2.5">
          <SectionLabel>{t("inbox.unassignedTitle")}</SectionLabel>
          {unassigned.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              {t("inbox.unassignedEmpty")}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {unassigned.map((item) => (
                <li key={item.id} className="space-y-2">
                  {renderItem(item)}
                  <div className="flex justify-end">
                    <AssignButton
                      staffToken={staffToken}
                      consultationToken={item.designerToken}
                      labels={{
                        assign: t("inbox.assign"),
                        assigning: t("inbox.assigning"),
                        assigned: t("inbox.assigned"),
                        failed: t("inbox.assignFailed"),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ScreenBody>
    </MobileFrame>
  );
}
