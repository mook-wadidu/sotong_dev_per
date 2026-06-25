"use client";

import * as React from "react";
import { toPng } from "html-to-image";
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
  GlobeIcon,
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
  /** 손님 요청 스타일 섹션 라벨(신규 보강) */
  styleRequest: string;
  /** 손님 고민 섹션 라벨(신규 보강) */
  concerns: string;
  /** 시술 주의사항 섹션 라벨(신규 보강) */
  cautions: string;
  book: string;
  bookToast: string;
  save: string;
  saveToast: string;
  saveError: string;
  share: string;
  shareToast: string;
  scoreLabel: string;
  grade: string;
  /** 프로필·방문이력(목업② 보강) 라벨 */
  nationality: string;
  gender: string;
  age: string;
  visitHistory: string;
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
  profile,
  visit,
}: {
  report: HairReport;
  labels: ReportLabels;
  dateLabel: string;
  nextVisitText: string;
  /** 손님 프로필(목업②) — 값 있는 항목만 노출. */
  profile?: { nationality?: string; gender?: string; ageText?: string };
  /** 방문 이력(카르테 연결 시). */
  visit?: { totalText: string; lastText?: string };
}) {
  const tone = GRADE_TONE[report.hairStateGrade];
  const score = Math.max(0, Math.min(100, report.hairStateScore));
  // 캡처 대상 — 리포트 카드 본문(저장/공유 버튼 영역은 제외).
  const captureRef = React.useRef<HTMLDivElement>(null);
  const [saving, setSaving] = React.useState(false);

  /** 리포트 카드를 고품질 PNG 로 렌더한다(외부 이미지 없음 — before/after 는 inline dataURL). */
  const renderPng = async (): Promise<string | null> => {
    const node = captureRef.current;
    if (!node) return null;
    return toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      // 캡처 배경을 카드와 맞춰 투명/대비 깨짐 방지.
      backgroundColor: "#ffffff",
    });
  };

  const fileName = `${report.salonName || "sotong"}-${report.date}.png`;

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const dataUrl = await renderPng();
      if (!dataUrl) {
        toast.error(labels.saveError);
        return;
      }
      // 공유 가능(파일)하면 share 시도, 아니면 다운로드.
      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function";
      if (canShareFiles) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: labels.title });
            return;
          }
        } catch {
          // share 실패/취소 → 다운로드 폴백
        }
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(labels.saveToast);
    } catch {
      toast.error(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

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
    <MobileFrame tone="muted" lang={report.locale}>
      <ScreenHeader title={labels.title} subtitle={labels.subtitle} />

      <ScreenBody className="space-y-4 pb-8">
        {/* 캡처 영역 — 저장/공유/예약 버튼 제외한 리포트 본문 */}
        <div ref={captureRef} className="space-y-4 bg-background">
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

        {/* 프로필(국적·성별·나이) + 방문이력 — 목업② 보강. 값 있을 때만. */}
        {profile?.nationality ||
        profile?.gender ||
        profile?.ageText ||
        visit ? (
          <Card>
            <CardContent className="space-y-3 p-5">
              {profile?.nationality || profile?.gender || profile?.ageText ? (
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {profile?.nationality ? (
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GlobeIcon className="size-3.5" />
                        {labels.nationality}
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {profile.nationality}
                      </p>
                    </div>
                  ) : null}
                  {profile?.gender ? (
                    <Meta label={labels.gender} value={profile.gender} />
                  ) : null}
                  {profile?.ageText ? (
                    <Meta label={labels.age} value={profile.ageText} />
                  ) : null}
                </div>
              ) : null}

              {visit ? (
                <>
                  {profile?.nationality ||
                  profile?.gender ||
                  profile?.ageText ? (
                    <Divider />
                  ) : null}
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CalendarIcon className="size-4" />
                      {labels.visitHistory}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {visit.totalText}
                      {visit.lastText ? ` · ${visit.lastText}` : ""}
                    </p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

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

        {/* 보강: 요청 스타일 · 고민 · 주의 (있을 때만) */}
        {report.styleRequest ? (
          <TextSection label={labels.styleRequest} value={report.styleRequest} />
        ) : null}
        {report.concerns ? (
          <TextSection label={labels.concerns} value={report.concerns} />
        ) : null}
        {report.cautions ? (
          <TextSection label={labels.cautions} value={report.cautions} />
        ) : null}

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
        </div>
        {/* /캡처 영역 */}

        {/* 저장(이미지 PNG) / 공유(링크 복사) */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={onSave}
            disabled={saving}
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

/** 보강 텍스트 섹션(요청 스타일·고민·주의) — 값이 있을 때만 렌더된다. */
function TextSection({ label, value }: { label: string; value: string }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <p className="text-pretty text-[0.95rem] leading-relaxed text-foreground">
        {value}
      </p>
    </section>
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
