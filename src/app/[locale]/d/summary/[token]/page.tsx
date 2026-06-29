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
  buttonVariants,
} from "@/components/ui";
import { StatusBadge } from "@/components/designer/status-badge";
import { BackToInbox } from "@/components/designer/back-to-inbox";
import { BeforePhotoCapture } from "@/components/designer/before-photo-capture";
import { DesignerHairInput } from "@/components/designer/designer-hair-input";
import { StartServiceButton } from "@/components/designer/start-service-button";
import { DesignerEmr } from "@/components/designer/designer-emr";
import { CustomerHistory } from "@/components/salon-console/customer-history";
import { ConsultationSummary } from "@/components/shared/consultation-summary";
import {
  AlertIcon,
  SparkleIcon,
  PriceTagIcon,
  CareIcon,
  CalendarIcon,
} from "@/components/icons";
import { designerThreadPath, reportPath } from "@/lib/links";
import { serviceLabels, INTAKE_CATEGORIES } from "@/lib/catalog";
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
  // MVP: 손님은 큰 분류만 고른다 → 분류 라벨(ko)로 표시. 레거시(serviceIds) 폴백.
  // ?? [] — 레거시/진행중 상담(JSONB 에 serviceCategoryIds 키 없음)에서 .map 크래시 방어.
  const categoryLabelsKo = (intake.serviceCategoryIds ?? [])
    .map((id) => INTAKE_CATEGORIES.find((c) => c.id === id)?.label.ko)
    .filter((x): x is string => !!x);
  const headline =
    s?.headline?.trim() ||
    categoryLabelsKo.join(", ") ||
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

  // 상담 정보 카드(목업① 흑백) 라벨 — ko 고정(디자이너 뷰).
  const summaryCardLabels = {
    title: t("summaryCard.title"),
    language: t("summaryCard.language"),
    purpose: t("summaryCard.purpose"),
    style: t("summaryCard.style"),
    photos: t("summaryCard.photos"),
    memo: t("summaryCard.memo"),
    gender: t("summaryCard.gender"),
    age: t("summaryCard.age"),
    ageValue: t("summaryCard.ageValue", { age: "{age}" }),
    step: {
      label: t("summaryCard.step.label"),
      booked: t("summaryCard.step.booked"),
      consulting: t("summaryCard.step.consulting"),
      done: t("summaryCard.step.done"),
    },
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

        {/* 상담 정보(목업① 흑백) — 언어/방문목적/스타일/사진/메모/성별·나이 + 진행 스테퍼 */}
        <ConsultationSummary
          language={t(`summaryCard.languageNames.${consultation.customerLocale}`)}
          services={
            categoryLabelsKo.length
              ? categoryLabelsKo
              : s?.services?.length
                ? s.services
                : serviceLabels(intake.serviceIds, "ko")
          }
          styleText={s?.styleDetail}
          photos={intake.stylePhotoUrls}
          memo={s?.concerns}
          gender={
            intake.gender
              ? t(`summaryCard.genderOpt.${intake.gender}`)
              : undefined
          }
          age={intake.age}
          status={status}
          labels={summaryCardLabels}
        />

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

        {/* 디자이너 입력 (선택) — 손님 인테이크에서 옮겨온 신체정보 + 알레르기 재확인 */}
        {!isCompleted ? (
          <DesignerHairInput
            designerToken={token}
            initial={consultation.designerInput}
            customerAllergy={intake.allergy}
            customerAllergyNote={intake.allergyNote}
          />
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
            {consultation.designerReportToken ?? consultation.reportToken ? (
              <Link
                href={reportPath(
                  // 디자이너는 한국어 리포트(designerReportToken)를 본다.
                  // 옛 완료건(없음)은 손님 리포트로 폴백(내용 언어는 report.locale 고정).
                  consultation.designerReportToken ?? consultation.reportToken!,
                  "ko",
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

      {/* 완료건은 CTA 숨김(읽기 전용). 미완료만 CTA: 대화하기 + 시술 시작. */}
      {isCompleted ? null : (
        <ScreenFooter>
          <div className="flex w-full flex-col gap-2">
            <Link
              href={designerThreadPath(token)}
              className={cn(
                buttonVariants({ variant: "accent", size: "lg" }),
                "w-full",
              )}
            >
              {t("summary.startConsult")}
            </Link>
            <StartServiceButton
              designerToken={token}
              status={status}
              labels={{
                start: t("summary.startService"),
                inService: t("inbox.inService"),
                failed: t("summary.startServiceFailed"),
              }}
            />
          </div>
        </ScreenFooter>
      )}
    </MobileFrame>
  );
}
