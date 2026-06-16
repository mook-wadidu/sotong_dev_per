import { getTranslations } from "next-intl/server";
import { getDesignerInbox } from "@/lib/service";
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
import { config } from "@/lib/config";
import type {
  ConsultationListItem as Item,
} from "@/lib/db/types";
import type { ConsultationStatus } from "@/lib/domain/types";

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
  const { staffToken } = await params;
  const t = await getTranslations("Designer");
  const data = await getDesignerInbox(staffToken);

  if (!data) {
    return (
      <MobileFrame tone="muted">
        <ScreenHeader title={t("inbox.title")} />
        <ScreenBody className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">{t("inbox.invalid")}</p>
        </ScreenBody>
      </MobileFrame>
    );
  }

  const { designer, salon, mine, unassigned } = data;

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
          <InboxRefresh
            label={t("inbox.refresh")}
            refreshingLabel={t("inbox.refreshing")}
          />
        }
      />
      <ScreenBody className="space-y-5">
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
