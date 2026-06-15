"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Divider,
  MobileFrame,
  ScreenBody,
  ScreenHeader,
  SectionLabel,
  toast,
} from "@/components/ui";
import {
  CutIcon,
  ClinicIcon,
  SparkleIcon,
  CalendarIcon,
  PhotoIcon,
} from "@/components/icons";
import type { HairReport, ThreeLevel } from "@/lib/domain/types";

export interface ReportLabels {
  title: string;
  subtitle: string;
  salon: string;
  designer: string;
  date: string;
  service: string;
  products: string;
  hairState: string;
  homeCare: string;
  nextVisit: string;
  before: string;
  after: string;
  book: string;
  bookToast: string;
  save: string;
  saveToast: string;
  share: string;
  shareToast: string;
  scoreLabel: string;
  grade: string;
}

/**
 * 모발 상태 등급별 게이지/뱃지 — Phase 3 흑백.
 * 색이 아니라 채움(잉크) + 등급 텍스트 라벨(Badge)로 의미를 전달한다.
 * 게이지 채움은 모든 등급 동일 잉크색이고, 등급 구분은 점수(width) + Badge 텍스트가 담당.
 */
const GRADE_TONE: Record<
  ThreeLevel,
  { bar: string; badge: "success" | "warning" | "destructive" }
> = {
  high: { bar: "bg-foreground", badge: "success" },
  mid: { bar: "bg-foreground", badge: "warning" },
  low: { bar: "bg-foreground", badge: "destructive" },
};

export function ReportView({
  report,
  labels,
  dateLabel,
  nextVisitText,
}: {
  report: HairReport;
  labels: ReportLabels;
  dateLabel: string;
  nextVisitText: string;
}) {
  const tone = GRADE_TONE[report.hairStateGrade];
  const score = Math.max(0, Math.min(100, report.hairStateScore));

  const onShare = async () => {
    if (typeof navigator !== "undefined" && "clipboard" in navigator) {
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch {
        // 무시 — 토스트로 안내만
      }
    }
    toast.success(labels.shareToast);
  };

  return (
    <MobileFrame tone="muted">
      <ScreenHeader title={labels.title} subtitle={labels.subtitle} />

      <ScreenBody className="space-y-4 pb-8">
        {/* 헤더 카드: 살롱 / 디자이너 / 날짜 */}
        <Card>
          <CardContent className="space-y-2.5 p-5">
            <div className="flex items-center justify-between gap-3">
              <Meta label={labels.salon} value={report.salonName} />
              <Meta
                label={labels.designer}
                value={report.designerName}
                align="right"
              />
            </div>
            <Divider />
            <Meta label={labels.date} value={dateLabel} />
          </CardContent>
        </Card>

        {/* 오늘 시술 */}
        <section>
          <SectionLabel className="flex items-center gap-1.5">
            <CutIcon className="size-4" />
            {labels.service}
          </SectionLabel>
          <p className="text-pretty text-[0.95rem] leading-relaxed text-foreground">
            {report.serviceSummary}
          </p>
        </section>

        {/* 모발 상태 게이지 */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <SectionLabel className="mb-0">{labels.hairState}</SectionLabel>
              <Badge variant={tone.badge}>{labels.grade}</Badge>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score}
              aria-label={labels.hairState}
              aria-valuetext={`${labels.scoreLabel} · ${labels.grade}`}
            >
              <div
                className={`h-full rounded-full ${tone.bar} transition-[width]`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-right text-sm font-semibold text-foreground">
              {labels.scoreLabel}
            </p>
          </CardContent>
        </Card>

        {/* before / after */}
        {(report.beforePhotoUrl || report.afterPhotoUrl) && (
          <div className="grid grid-cols-2 gap-3">
            <PhotoSlot label={labels.before} url={report.beforePhotoUrl} />
            <PhotoSlot label={labels.after} url={report.afterPhotoUrl} />
          </div>
        )}

        {/* 사용한 제품 */}
        {report.products.length > 0 && (
          <section>
            <SectionLabel className="flex items-center gap-1.5">
              <ClinicIcon className="size-4" />
              {labels.products}
            </SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {report.products.map((p, i) => (
                <Badge key={i} variant="accent">
                  {p}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* 홈케어 가이드 */}
        {report.homeCare.length > 0 && (
          <section>
            <SectionLabel className="flex items-center gap-1.5">
              <SparkleIcon className="size-4" />
              {labels.homeCare}
            </SectionLabel>
            <ul className="space-y-2">
              {report.homeCare.map((c, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-[0.95rem] leading-snug text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-text"
                  >
                    {i + 1}
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 다음 방문 권장 + 예약 */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarIcon className="size-4" />
                {labels.nextVisit}
              </p>
              <p className="mt-0.5 text-base font-semibold text-accent-text">
                {nextVisitText}
              </p>
            </div>
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={() => toast.success(labels.bookToast)}
            >
              {labels.book}
            </Button>
          </CardContent>
        </Card>

        {/* 저장 / 공유 (mock) */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => toast.success(labels.saveToast)}
          >
            {labels.save}
          </Button>
          <Button variant="outline" size="lg" onClick={onShare}>
            {labels.share}
          </Button>
        </div>
      </ScreenBody>
    </MobileFrame>
  );
}

function Meta({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PhotoSlot({ label, url }: { label: string; url?: string }) {
  return (
    <figure className="space-y-1.5">
      <div className="aspect-square overflow-hidden rounded-xl border border-border bg-card">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <PhotoIcon className="size-7" />
          </div>
        )}
      </div>
      <figcaption className="text-center text-xs font-medium text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}
