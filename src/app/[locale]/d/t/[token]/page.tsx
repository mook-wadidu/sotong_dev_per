import { getTranslations } from "next-intl/server";
import { getDesignerView } from "@/lib/service";
import { estimatePrice } from "@/lib/catalog";
import {
  MobileFrame,
  ScreenHeader,
  Badge,
} from "@/components/ui";
import { DesignerThread } from "@/components/designer/designer-thread";
import { BackToInbox } from "@/components/designer/back-to-inbox";

/**
 * D3 — 디자이너 ↔ 손님 번역 스레드(ko 고정).
 * 서버에서 초기 메시지/손님 미니정보를 받아 클라이언트 스레드에 넘긴다.
 */
export default async function DesignerThreadPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("Designer");
  const view = await getDesignerView(token);

  if (!view) {
    return (
      <MobileFrame tone="muted">
        <ScreenHeader title={t("thread.title")} />
        <div className="flex flex-1 items-center justify-center px-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("summary.notFound")}
          </p>
        </div>
      </MobileFrame>
    );
  }

  const { consultation, messages, staffToken } = view;
  const s = consultation.summary;

  // price 칩 자동 프리필용 예상가(KRW won) — 인테이크 시술 합산.
  const estimatedPriceWon =
    estimatePrice(consultation.intake.serviceIds) ?? undefined;

  // 손님 미니정보 (헤드라인 + 국적/방문 배지)
  const miniSubtitle = s?.headline ?? s?.services?.join(", ") ?? "";

  return (
    <MobileFrame>
      <ScreenHeader
        title={t("thread.title")}
        subtitle={miniSubtitle}
        leading={
          <BackToInbox staffToken={staffToken} label={t("inbox.backToInbox")} />
        }
        trailing={
          <div className="flex items-center gap-1">
            <Badge variant="outline">
              {s?.nationality ?? consultation.customerLocale}
            </Badge>
            <Badge variant={consultation.isReturning ? "default" : "accent"}>
              {consultation.isReturning ? t("inbox.returning") : t("inbox.new")}
            </Badge>
          </div>
        }
      />

      <DesignerThread
        token={token}
        initialMessages={messages}
        estimatedPriceWon={estimatedPriceWon}
        labels={{
          quickTitle: t("thread.quickReplies.title"),
          customLabel: t("thread.quickReplies.customLabel"),
          send: t("thread.quickReplies.send"),
          placeholder: t("thread.placeholder"),
          pricePrompt: t("thread.quickReplies.pricePrompt"),
          timePrompt: t("thread.quickReplies.timePrompt"),
          pending: t("thread.pending"),
          translatedNote: t("thread.translatedNote"),
          autoPrice: t("thread.quickReplies.autoPrice"),
          reportCta: t("thread.reportCta"),
          sendError: t("thread.sendError"),
          moreLabel: t("thread.quickReplies.moreLabel"),
          moreTitle: t("thread.quickReplies.moreTitle"),
          groupGreeting: t("thread.quickReplies.groups.greeting"),
          groupResponse: t("thread.quickReplies.groups.response"),
          groupProgress: t("thread.quickReplies.groups.progress"),
          groupClosing: t("thread.quickReplies.groups.closing"),
        }}
      />
    </MobileFrame>
  );
}
