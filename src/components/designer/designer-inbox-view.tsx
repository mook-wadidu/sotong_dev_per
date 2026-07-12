import { getTranslations } from "next-intl/server";
import { makeDesignerEntryToken } from "@/lib/entry";
import { customerEntryPath } from "@/lib/links";
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
  Designer,
  PublicSalon,
  ConsultationListItem as Item,
} from "@/lib/db/types";
import type { ConsultationStatus } from "@/lib/domain/types";

/**
 * 디자이너 인박스 렌더 — 토큰 URL(`/d/inbox/[staffToken]`)과 세션형(`/d/inbox`)이 공유.
 * 데이터 로드/side-effect(last_seen)는 각 페이지가 하고, 렌더만 여기서.
 * 디자이너 뷰 = ko 고정.
 */
export async function DesignerInboxView({
  data,
  staffToken,
  origin,
}: {
  data: {
    designer: Designer;
    salon: PublicSalon;
    mine: Item[];
    unassigned: Item[];
  };
  staffToken: string;
  origin: string;
}) {
  const t = await getTranslations("Designer");
  const { designer, salon, mine, unassigned } = data;

  const myEntryPath = customerEntryPath(
    makeDesignerEntryToken(designer.id, designer.entryKeyVersion),
  );
  const myEntryUrl = origin ? origin + myEntryPath : myEntryPath;

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
              <p className="text-sm text-muted-foreground">{t("inbox.empty")}</p>
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
