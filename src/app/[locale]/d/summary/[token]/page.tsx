import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDesignerView } from "@/lib/service";
import {
  MobileFrame,
  ScreenHeader,
  ScreenBody,
  ScreenFooter,
  Badge,
  Card,
  CardContent,
  Divider,
  buttonVariants,
} from "@/components/ui";
import { StatusBadge } from "@/components/designer/status-badge";
import { BackToInbox } from "@/components/designer/back-to-inbox";
import { BeforePhotoCapture } from "@/components/designer/before-photo-capture";
import { DesignerEmr } from "@/components/designer/designer-emr";
import { CustomerHistory } from "@/components/salon-console/customer-history";
import {
  AlertIcon,
  SparkleIcon,
  PhotoIcon,
  PriceTagIcon,
  CareIcon,
  CalendarIcon,
} from "@/components/icons";
import { designerThreadPath, reportPath } from "@/lib/links";
import { serviceLabels } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { ConsultationStatus } from "@/lib/domain/types";

/**
 * D2 — 디자이너용 손님 요약(ko 고정).
 * getDesignerView(designerToken) → headline 크게 + Badge + raw 분해 카드 +
 * 스타일 사진 + 고민/주의 강조. CTA: "상담 시작" 1개(→ 스레드).
 */
export default async function DesignerSummaryPage({
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
        <ScreenHeader title={t("summary.title")} />
        <ScreenBody className="flex flex-1 items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">{t("summary.notFound")}</p>
        </ScreenBody>
      </MobileFrame>
    );
  }

  const { salon, consultation, staffToken, messages } = view;
  const s = consultation.summary;
  const intake = consultation.intake;
  const status = consultation.status;
  const isCompleted = status === "completed";

  // AI 요약 실패 시에도 'cut_women' 같은 raw id 가 제목으로 노출되지 않게(AUDIT UX P2):
  // 카탈로그 라벨(ko) → 없으면 요약 시술명 → 그래도 없으면 안내 문구.
  const headline =
    s?.headline?.trim() ||
    serviceLabels(intake.serviceIds, "ko").join(", ") ||
    s?.services?.join(", ") ||
    t("summary.untitled");

  const statusLabel = (st: ConsultationStatus): string => {
    switch (st) {
      // 대기: 미열람(intake) / 상담 단계(consulting)
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

  return (
    <MobileFrame tone="muted">
      <ScreenHeader
        title={salon?.name ?? t("summary.title")}
        subtitle={t("summary.title")}
        leading={
          <BackToInbox staffToken={staffToken} label={t("inbox.backToInbox")} />
        }
        trailing={<StatusBadge status={status} label={statusLabel(status)} />}
      />

      <ScreenBody className="space-y-4 pb-2">
        {/* 헤드라인 + 핵심 배지 */}
        <div className="space-y-2.5">
          <h1 className="text-xl font-bold leading-snug tracking-tight">
            {headline}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              {t("summary.nationality")}:{" "}
              {s?.nationality ?? ""}
            </Badge>
            <Badge variant={consultation.isReturning ? "default" : "accent"}>
              {consultation.isReturning
                ? t("inbox.returning")
                : t("inbox.new")}
            </Badge>
            <Badge variant="outline">
              {consultation.designerName ?? t("inbox.unassigned")}
            </Badge>
            {s?.estimatedPrice ? (
              <Badge variant="info" className="gap-1">
                <PriceTagIcon className="size-3.5" />
                {t("summary.estimatedPrice")}: {s.estimatedPrice}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* 주의사항 강조 (알레르기 항상 노출) — 색 대신 굵은 좌측 외곽선 + 라벨로 강조 */}
        <Card className="border-l-4 border-l-foreground bg-muted">
          <CardContent className="space-y-1 p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-foreground">
              <AlertIcon className="size-4" />
              {t("summary.cautions")}
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {s?.hairCautions?.trim() || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("summary.allergy")}:{" "}
              {intake.allergy
                ? intake.allergyNote?.trim() || t("summary.allergyYes")
                : t("summary.allergyNone")}
            </p>
          </CardContent>
        </Card>

        {/* raw 분해 카드 */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <DetailRow
              label={t("summary.services")}
              value={s?.services?.length ? s.services.join(", ") : "—"}
            />
            <Divider />
            <DetailRow
              label={t("summary.styleDetail")}
              value={s?.styleDetail?.trim() || "—"}
            />
            <Divider />
            <DetailRow
              label={t("summary.concerns")}
              value={s?.concerns?.trim() || "—"}
            />
          </CardContent>
        </Card>

        {/* AI 요약 본문 */}
        {s?.raw?.trim() ? (
          <Card>
            <CardContent className="p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <SparkleIcon className="size-4" />
                {t("summary.fullSummary")}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {s.raw}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* 시술 전 사진 촬영 (선택) — 요약 단계에서 찍어두면 리포트 before 로 쓰임 */}
        <Card>
          <CardContent className="p-4">
            <BeforePhotoCapture
              designerToken={token}
              initialUrl={consultation.beforePhotoUrl}
              labels={{
                title: t("beforePhoto.title"),
                hint: t("beforePhoto.hint"),
                add: t("beforePhoto.add"),
                retake: t("beforePhoto.retake"),
                saved: t("beforePhoto.saved"),
                failed: t("beforePhoto.failed"),
                alt: t("beforePhoto.alt"),
                done: t("beforePhoto.done"),
              }}
            />
          </CardContent>
        </Card>

        {/* 스타일 참고 사진 — 구/부분 intake 로 stylePhotoUrls 가 없을 수 있어 방어 */}
        {(intake.stylePhotoUrls ?? []).length > 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <PhotoIcon className="size-4" />
              {t("summary.photos")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(intake.stylePhotoUrls ?? []).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`${t("summary.photos")} ${i + 1}`}
                  className="aspect-square w-full rounded-xl border border-border object-cover"
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* 완료(completed): EMR(종합 전자차트) — 시술기록·약제·모발상태·만족도 + 비포 + 대화 하이라이트 + 고객 리포트 링크. 읽기 전용. */}
        {isCompleted ? (
          <div className="space-y-4 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 text-base font-bold text-foreground">
              <CareIcon className="size-5" />
              {t("emr.title")}
            </p>
            <DesignerEmr
              record={view.treatmentRecord}
              serviceLabelMap={view.serviceLabelMap}
              messages={messages}
              beforePhotoUrl={consultation.beforePhotoUrl}
            />
            {consultation.reportToken ? (
              <Link
                href={reportPath(
                  consultation.reportToken,
                  consultation.customerLocale,
                )}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full",
                )}
              >
                {t("emr.viewReport")}
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* 손님의 지난 이력(모든 status) — 재방문 카르테. 신규/이력없음이면 숨김. 접이식. */}
        {view.customerTreatments.length > 0 ? (
          <details className="group rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="size-4" />
                {t("history.title")}
              </span>
              <span
                aria-hidden="true"
                className="text-base leading-none text-muted-foreground transition-transform group-open:rotate-90"
              >
                ›
              </span>
            </summary>
            <div className="border-t border-border p-4">
              <CustomerHistory
                locale="ko"
                treatments={view.customerTreatments}
                serviceLabelMap={view.serviceLabelMap}
              />
            </div>
          </details>
        ) : null}
      </ScreenBody>

      {/* 완료건은 "상담 시작" 숨김(읽기 전용). 미완료만 CTA 노출. */}
      {isCompleted ? null : (
        <ScreenFooter>
          <Link
            href={designerThreadPath(token)}
            className={cn(
              buttonVariants({ variant: "accent", size: "lg" }),
              "w-full",
            )}
          >
            {t("summary.startConsult")}
          </Link>
        </ScreenFooter>
      )}
    </MobileFrame>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {value}
      </p>
    </div>
  );
}
