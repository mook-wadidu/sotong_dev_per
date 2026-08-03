"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import {
  Button,
  MobileFrame,
  ScreenHeader,
  ScreenBody,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  buttonVariants,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { getConsultationStatus } from "@/lib/actions";
import { reportPath, customerThreadPath } from "@/lib/links";
import { JourneyBar, deriveStage, type JourneyStage } from "@/components/customer/journey-bar";
import { CopyLink } from "./copy-link";
import type { ConsultationStatus, Locale } from "@/lib/domain/types";

// present 는 전부 "곧 바뀔" 대기 상태(제출직후/확인중)라 빠른 폴(2s).
// 상담시작(chat_started)되면 손님은 채팅방으로 이동하므로 여기서 저빈도 폴은 불필요(B2 채팅쪽).
const POLL_MS = 2000;

/**
 * 제시(present) 라이브 — 서버 정적이던 화면을 폴링 상태머신으로.
 * 파생 상태(역순): completed → 리포트 / chat_started → 채팅 자동입장 / designer_viewed → "확인 중" / 그 외 → QR.
 * "멈춘 느낌" 제거: 상단 JourneyBar(위치 감각) + 확인중 대기 카피(무한 스피너 없음).
 */
export function PresentLive({
  token,
  locale,
  qrUrl,
  myLink,
  initialStatus,
  initialReportToken,
  initialDesignerViewedAt,
  initialChatStartedAt,
  initialDesignerEditingAt,
}: {
  token: string;
  locale: Locale;
  qrUrl: string;
  myLink: string;
  initialStatus: ConsultationStatus;
  initialReportToken?: string;
  initialDesignerViewedAt?: string;
  initialChatStartedAt?: string;
  initialDesignerEditingAt?: string;
}) {
  const router = useRouter();
  const t = useTranslations("Customer");
  const tCommon = useTranslations("Common");
  const [status, setStatus] = React.useState(initialStatus);
  const [reportToken, setReportToken] = React.useState(initialReportToken);
  const [viewedAt, setViewedAt] = React.useState(initialDesignerViewedAt);
  const [chatStartedAt, setChatStartedAt] = React.useState(initialChatStartedAt);
  const [editingAt, setEditingAt] = React.useState(initialDesignerEditingAt);
  const [qrOpen, setQrOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const st = await getConsultationStatus(token);
        if (!active || !st) return;
        setStatus(st.status);
        setReportToken(st.reportToken);
        setViewedAt(st.designerViewedAt);
        setChatStartedAt(st.chatStartedAt);
        setEditingAt(st.designerEditingAt);
      } catch {
        /* 폴 실패는 조용히 무시(다음 tick 재시도) */
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  // 상담 시작 → 손님도 함께 채팅방으로 자동입장(완료가 아니면).
  React.useEffect(() => {
    if (chatStartedAt && status !== "completed") {
      router.replace(customerThreadPath(token, locale));
    }
  }, [chatStartedAt, status, token, locale, router]);

  const stage = deriveStage({
    status,
    chatStartedAt,
    designerViewedAt: viewedAt,
    designerEditingAt: editingAt,
  });

  // 완료 + 리포트 → 이 개인 링크가 리포트 확인처로 전환.
  if (status === "completed" && reportToken) {
    return (
      <Shell stage={stage} t={t}>
        <p className="text-lg font-bold leading-snug text-foreground">
          {t("present.completed")}
        </p>
        <Link
          href={reportPath(reportToken, locale)}
          className={cn(
            buttonVariants({ variant: "accent", size: "lg" }),
            "w-full",
          )}
        >
          {t("present.viewReport")}
        </Link>
      </Shell>
    );
  }

  // 상담 시작됨 → 채팅으로 이동 중(effect가 replace). 잠깐의 안내.
  if (chatStartedAt) {
    return (
      <Shell stage={stage} t={t}>
        <p className="text-sm text-muted-foreground">{t("present.reviewingHint")}</p>
      </Shell>
    );
  }

  const qrNode = (
    <div className="rounded-2xl border border-border bg-white p-4">
      <QRCodeSVG value={qrUrl} size={224} level="M" marginSize={0} />
    </div>
  );

  return (
    <Shell stage={stage} t={t}>
      {editingAt || viewedAt ? (
        // 확인 중 / 입력 중 — "지금 무슨 일 + (할 일 없음)" 2줄 + QR 다시보기(팝업)
        <div className="flex w-full flex-col items-center gap-3">
          <p className="text-base font-bold leading-snug text-foreground">
            {editingAt
              ? t("present.editingTitle")
              : t("present.reviewingTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("present.reviewingHint")}
          </p>
          <Button
            variant="outline"
            size="lg"
            className="mt-1 w-full"
            onClick={() => setQrOpen(true)}
          >
            {t("present.reshowQr")}
          </Button>
        </div>
      ) : (
        // 제출 직후 — QR 노출(디자이너 스캔용) + 고정 한국어 안내
        <div className="flex w-full flex-col items-center gap-4">
          <p
            lang="ko"
            className="w-full rounded-xl border border-border bg-accent-soft/60 px-4 py-3 text-sm font-semibold leading-relaxed text-accent-text"
          >
            다음 QR을 스캔하여 고객이 원하는 시술 정보를 확인하세요!
          </p>
          {qrNode}
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => router.refresh()}
          >
            {t("present.reshow")}
          </Button>
        </div>
      )}

      {/* 손님 저장용 "내 링크" — 항상. 기기 무관 재진입 + 시술 후 리포트도 여기서. */}
      <div className="w-full space-y-1.5">
        <p className="text-left text-xs font-semibold text-foreground">
          {t("present.myLinkTitle")}
        </p>
        <CopyLink
          value={myLink}
          copyLabel={t("present.copy")}
          copiedMsg={t("present.copied")}
        />
        <p className="text-left text-xs leading-relaxed text-muted-foreground">
          {t("present.saveLinkHint")}
        </p>
      </div>

      {/* QR 팝업 — 확인 중 상태에서 다시 보여주기(재스캔용). */}
      <Sheet open={qrOpen} onOpenChange={setQrOpen}>
        <SheetContent closeLabel={tCommon("close")}>
          <SheetHeader>
            <SheetTitle>{t("present.title")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex justify-center">{qrNode}</div>
        </SheetContent>
      </Sheet>
    </Shell>
  );
}

function Shell({
  stage,
  t,
  children,
}: {
  stage: JourneyStage;
  t: ReturnType<typeof useTranslations>;
  children: React.ReactNode;
}) {
  return (
    <MobileFrame tone="muted">
      <ScreenHeader title={t("present.title")} />
      <div className="px-4 pt-3">
        <JourneyBar stage={stage} />
      </div>
      <ScreenBody className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
        {children}
      </ScreenBody>
    </MobileFrame>
  );
}
