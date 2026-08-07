import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getDesignerView } from "@/lib/service";
import { shareOrigin } from "@/lib/origin";
import {
  MobileFrame,
  ScreenHeader,
  ScreenBody,
  Card,
  CardContent,
} from "@/components/ui";
import { RecordForm } from "@/components/designer/record-form";
import { BackToInbox } from "@/components/designer/back-to-inbox";
import { INTAKE_CATEGORIES } from "@/lib/catalog";

/**
 * D5 — 30초 기록 → 리포트 발송(ko 고정).
 * 색감(COLOR_TONES) / 실매장명 / 모발상태(상·중·하) / before·after 사진.
 * 발송 후 손님 locale 의 리포트 링크 노출.
 */
// 리포트 발송(finishAndSendReport→completeConsultation)은 외국인 손님 시 AI draft 2회 +
// 번역이 직렬로 돌아 최악 ~20s. 기본 서버리스 타임아웃(504)에 걸리지 않게 상한을 넉넉히(D).
export const maxDuration = 60;

export default async function DesignerReportPage({
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
        <ScreenHeader title={t("record.title")} />
        <ScreenBody className="flex flex-1 items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            {t("summary.notFound")}
          </p>
        </ScreenBody>
      </MobileFrame>
    );
  }

  const { consultation, staffToken, customerTreatments } = view;
  const s = consultation.summary;
  const intake = consultation.intake;
  // 상담 내용 요약(읽기전용) — 디자이너가 시술 확정 전 검토. 시술 분류는 ko 라벨로.
  const categoryLabelsKo = (intake.serviceCategoryIds ?? [])
    .map((id) => INTAKE_CATEGORIES.find((c) => c.id === id)?.label.ko)
    .filter((x): x is string => !!x);
  const styleText = s?.styleDetail?.trim() || intake.styleNote?.trim();
  const concernText = s?.concerns?.trim() || intake.concernNote?.trim();
  const cautionText = s?.hairCautions?.trim();
  const allergyText = intake.allergy
    ? intake.allergyNote?.trim() || "있음"
    : "없음";
  // 손님 리포트 절대 URL prefix — 완결 후 손님 reportToken 을 붙여 인체어 QR 로 전달(B7).
  const h = await headers();
  const origin = shareOrigin(
    h.get("host"),
    h.get("x-forwarded-proto") ?? "http",
  );
  // 재방문 프리필(PRD NOW #5) — 가장 최근 지난 시술의 모발 상태를 기록폼 기본값으로.
  const lastTreatment = consultation.isReturning
    ? customerTreatments[0]
    : undefined;

  return (
    <MobileFrame tone="muted">
      <ScreenHeader
        title={t("record.title")}
        subtitle={t("record.subtitle")}
        leading={
          <BackToInbox staffToken={staffToken} label={t("inbox.backToInbox")} />
        }
      />
      <ScreenBody className="space-y-4">
        {/* 상담 내용(읽기전용) — 시술 확정 전 검토. */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-bold text-foreground">상담 내용</p>
            <RecapRow label="시술 분류" value={categoryLabelsKo.join(", ") || "—"} />
            {styleText ? <RecapRow label="원하는 스타일" value={styleText} /> : null}
            {concernText ? <RecapRow label="고민" value={concernText} /> : null}
            {intake.desiredColor ? (
              <RecapRow label="희망 색감" value={intake.desiredColor} />
            ) : null}
            {cautionText ? <RecapRow label="주의" value={cautionText} /> : null}
            <RecapRow label="알레르기" value={allergyText} />
          </CardContent>
        </Card>

        <RecordForm
          token={token}
          beforeUrl={consultation.beforePhotoUrl}
          defaultGrade={lastTreatment?.stateGrade}
          requestedCategoryIds={intake.serviceCategoryIds ?? []}
          customerReportOrigin={origin}
          customerLocale={consultation.customerLocale}
          labels={{
            reportQrTitle: t("record.reportQrTitle"),
            reportQrHint: t("record.reportQrHint"),
            stateGrade: t("record.stateGrade"),
            beforePhoto: t("record.beforePhoto"),
            afterPhoto: t("record.afterPhoto"),
            addPhoto: t("record.addPhoto"),
            removePhoto: t("record.removePhoto"),
            finish: t("record.finish"),
            finishing: t("record.finishing"),
            sent: t("record.sent"),
            failed: t("record.failed"),
            needInput: t("record.needInput"),
            needPhotos: t("record.needPhotos"),
            prefillHint: t("record.prefillHint"),
            prefillClear: t("record.prefillClear"),
            openReport: t("record.openReport"),
            gradeHigh: t("record.grade.high"),
            gradeMid: t("record.grade.mid"),
            gradeLow: t("record.grade.low"),
          }}
        />
      </ScreenBody>
    </MobileFrame>
  );
}

/** 상담 내용 recap 한 줄 — 라벨 + 값. */
function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 whitespace-pre-wrap text-foreground">{value}</span>
    </div>
  );
}
