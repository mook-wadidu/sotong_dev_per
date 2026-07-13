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
  AlertIcon,
} from "@/components/icons";
import { HairDna } from "./hair-dna";
import { SatisfactionStars } from "./satisfaction-stars";
import { BackButton } from "./back-button";
import { cn } from "@/lib/utils";
import type {
  HairReport,
  ThreeLevel,
  FaceShape,
  HairType,
} from "@/lib/domain/types";

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
  before: string;
  after: string;
  /** 손님 요청 스타일 섹션 라벨(신규 보강) */
  styleRequest: string;
  /** 손님 고민 섹션 라벨(신규 보강) */
  concerns: string;
  /** 시술 주의사항 섹션 라벨(신규 보강) */
  cautions: string;
  /** 헤어/얼굴형 DNA 카드 라벨. */
  dna: {
    title: string;
    volume: string;
    density: string;
    wave: string;
    faceShape: string;
  };
  /** 손님 만족도 별점 라벨. */
  satisfaction: {
    title: string;
    thanks: string;
    error: string;
    /** 디자이너 읽기전용 안내(손님 입력 영역). */
    readOnly: string;
  };
  /** 뒤로 버튼 라벨. */
  back: string;
  save: string;
  saveToast: string;
  saveError: string;
  share: string;
  shareToast: string;
  scoreLabel: string;
  grade: string;
  /** 디자이너가 모발 상태를 기록하지 않은 경우(stateEstimated) 점수 대신 표시할 정직 문구 */
  stateNote?: string;
  /** 프로필·방문이력(목업② 보강) 라벨 */
  nationality: string;
  gender: string;
  age: string;
  visitHistory: string;
  /** 지난 방문 기록(재방문 카드) 라벨 — 있을 때만 카드 노출 */
  pastVisit?: {
    title: string;
    lastService: string;
    preference: string;
    memo: string;
  };
  /** 항목별 범위 막대(InBody 골격근-지방분석) 라벨. 옵셔널 — 없으면 한국어 기본값. */
  analysis?: {
    title: string;
    standardLow: string; // 표준이하
    standard: string; // 표준
    standardHigh: string; // 표준이상
    vsStandard: string; // "표준대비"
  };
  /** 모발 유형 분류(InBody CID 유형) 라벨. 옵셔널 — 없으면 한국어 기본값. */
  hairType?: {
    title: string;
    /** 유형 레터별 이름·설명. 키: H|V|S|C */
    types: Record<string, { name: string; desc: string }>;
  };
}

/* ── 새 InBody 섹션 라벨 한국어 기본값(옵셔널 라벨 폴백) ── */
const ANALYSIS_FALLBACK = {
  title: "항목별 상세 분석",
  standardLow: "표준이하",
  standard: "표준",
  standardHigh: "표준이상",
  vsStandard: "표준대비",
} as const;

const HAIR_TYPE_FALLBACK = {
  title: "모발 유형",
  types: {
    H: { name: "건강·풍성형", desc: "모발 상태가 좋고 볼륨·숱이 넉넉해요. 지금 컨디션을 유지하는 홈케어면 충분해요." },
    V: { name: "건강·볼륨케어형", desc: "모발 상태는 좋지만 볼륨·숱을 조금 더 살리면 스타일이 오래가요." },
    S: { name: "표준형", desc: "전반적으로 균형 잡힌 모발이에요. 기본 홈케어를 꾸준히 이어가세요." },
    C: { name: "집중케어형", desc: "모발이 다소 지쳐 있어요. 수분·단백질 케어에 집중하면 빠르게 회복돼요." },
  },
} as const;

/* ── 항목별 범위 막대(InBody 골격근-지방분석) ─────────────── */
type RangeRow = { label: string; level: ThreeLevel; valueText?: string };

// ThreeLevel → 3구간 위치(0=표준이하,1=표준,2=표준이상) + 표준대비 %.
const LEVEL_META: Record<ThreeLevel, { seg: 0 | 1 | 2; pct: number }> = {
  low: { seg: 0, pct: 85 },
  mid: { seg: 1, pct: 100 },
  high: { seg: 2, pct: 115 },
};

/** 모발 상태·숱에서 유형 레터를 결정적으로 파생(InBody CID 유형 analog). */
function classifyHairType(
  grade: ThreeLevel,
  density?: ThreeLevel,
): "H" | "V" | "S" | "C" {
  if (grade === "high") return density === "high" ? "H" : "V";
  if (grade === "mid") return "S";
  return "C";
}

function RangeBar({
  row,
  labels,
}: {
  row: RangeRow;
  labels: {
    standardLow: string;
    standard: string;
    standardHigh: string;
    vsStandard: string;
  };
}) {
  const meta = LEVEL_META[row.level];
  const segLabels = [labels.standardLow, labels.standard, labels.standardHigh];
  const markerLeft = `${meta.seg * 33.333 + 16.666}%`;
  const bigValue = row.valueText ?? `${meta.pct}%`;
  return (
    <div
      role="group"
      aria-label={`${row.label} — ${segLabels[meta.seg]}`}
    >
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{row.label}</span>
        <span className="flex items-baseline gap-1.5">
          {!row.valueText ? (
            <span className="text-[0.65rem] text-muted-foreground">
              {labels.vsStandard}
            </span>
          ) : null}
          <span className="text-lg font-bold text-foreground">{bigValue}</span>
          <span className="text-[0.7rem] font-semibold text-accent-text">
            {segLabels[meta.seg]}
          </span>
        </span>
      </div>
      <div className="relative">
        <div className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2.5 flex-1 rounded-full transition-colors",
                s === meta.seg ? "bg-accent-strong" : "bg-muted",
              )}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-accent-strong shadow-sm"
          style={{ left: markerLeft }}
        />
      </div>
      <div className="mt-1 flex text-[0.65rem] text-muted-foreground">
        <span className="flex-1 text-left">{segLabels[0]}</span>
        <span className="flex-1 text-center">{segLabels[1]}</span>
        <span className="flex-1 text-right">{segLabels[2]}</span>
      </div>
    </div>
  );
}

/* ── 모발 유형 카드(InBody CID 유형) ──────────────────────── */
function HairTypeCard({
  title,
  letter,
  name,
  desc,
  rows,
}: {
  title: string;
  letter: string;
  name: string;
  desc: string;
  rows: RangeRow[];
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <SectionLabel className="mb-0">{title}</SectionLabel>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {rows.map((row) => {
              const meta = LEVEL_META[row.level];
              return (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 truncate text-[0.7rem] text-muted-foreground">
                    {row.label}
                  </span>
                  <div className="flex flex-1 gap-1" aria-hidden="true">
                    {[0, 1, 2].map((s) => (
                      <div
                        key={s}
                        className={cn(
                          "h-2 flex-1 rounded-full",
                          s === meta.seg ? "bg-accent-strong" : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <span
            aria-hidden="true"
            className="text-5xl font-black leading-none text-accent-strong"
          >
            {letter}
          </span>
        </div>
        <div className="rounded-xl bg-accent-soft p-3.5">
          <p className="text-sm font-bold text-foreground">{name}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {desc}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportView({
  report,
  labels,
  dateLabel,
  profile,
  visit,
  pastVisit,
  hair,
  demo = false,
  canRate = true,
  satisfactionScore,
  homeHref,
  embedded = false,
}: {
  report: HairReport;
  labels: ReportLabels;
  dateLabel: string;
  /** 손님 프로필(목업②) — 값 있는 항목만 노출. */
  profile?: { nationality?: string; gender?: string; ageText?: string };
  /** 방문 이력(카르테 연결 시). */
  visit?: { totalText: string; lastText?: string };
  /** 지난 방문 요약(재방문 카드) — 카르테 연결/데모 시. 값 있을 때만 노출. */
  pastVisit?: { lastService?: string; preference?: string; memo?: string };
  /** 헤어/얼굴형 DNA 시각화 데이터 — 없으면 카드 미표시. */
  hair?: {
    faceShape?: FaceShape;
    crownVolume?: ThreeLevel;
    hairDensity?: ThreeLevel;
    hairType?: HairType;
  };
  /** 데모 모드 — 별점은 저장 없이 표시만. */
  demo?: boolean;
  /** 별점 입력 권한 — 손님(true, 기본)만 입력. 디자이너 뷰는 false → 읽기전용. */
  canRate?: boolean;
  /** 디자이너 읽기전용에서 표시할 손님 제출 점수(1~5). */
  satisfactionScore?: number;
  /** 뒤로 버튼의 no-history 폴백 경로. 미지정 시 손님 랜딩(`/{report.locale}`). 디자이너 뷰는 디자이너 경로 전달. */
  homeHref?: string;
  /** 폰 목업 안 임베드 — MobileFrame 이 뷰포트 대신 폰 화면 높이를 채운다. */
  embedded?: boolean;
}) {
  const score = Math.max(0, Math.min(100, report.hairStateScore));
  const hasDna = !!(
    hair &&
    (hair.faceShape || hair.crownVolume || hair.hairDensity || hair.hairType)
  );
  // 새 InBody 섹션 라벨(옵셔널 → 한국어 폴백) + 유형 분류.
  const aLabels = labels.analysis ?? ANALYSIS_FALLBACK;
  const tLabels = labels.hairType ?? HAIR_TYPE_FALLBACK;
  const typeLetter = classifyHairType(report.hairStateGrade, hair?.hairDensity);
  const typeInfo = tLabels.types[typeLetter] ?? HAIR_TYPE_FALLBACK.types[typeLetter];
  // 항목별 범위 막대 데이터 — 볼륨/숱은 ThreeLevel, 모발상태는 점수.
  const rangeRows: RangeRow[] = [
    ...(hair?.crownVolume
      ? [{ label: labels.dna.volume, level: hair.crownVolume }]
      : []),
    ...(hair?.hairDensity
      ? [{ label: labels.dna.density, level: hair.hairDensity }]
      : []),
    // 모발 상태 행 — 디자이너 미기록(stateEstimated)이면 조작 점수를 빼고 생략.
    ...(report.stateEstimated
      ? []
      : [
          {
            label: labels.hairState,
            level: report.hairStateGrade,
            valueText: labels.scoreLabel,
          },
        ]),
  ];
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
    <MobileFrame tone="muted" lang={report.locale} embedded={embedded}>
      <ScreenHeader
        title={labels.title}
        subtitle={labels.subtitle}
        leading={
          // 데모는 자체 하단 내비(Replay 등)를 쓰므로 back 미노출(router.back()이 데모를 벗어남).
          demo ? undefined : (
            <BackButton
              label={labels.back}
              homeHref={homeHref ?? `/${report.locale}`}
            />
          )
        }
      />

      <ScreenBody className="space-y-4 pb-8">
        {/* 캡처 영역 — 저장/공유/예약 버튼 제외한 리포트 본문 */}
        <div ref={captureRef} className="space-y-4 bg-background">
        {/* 그라데이션 히어로 — 살롱/디자이너/날짜 + 큰 모발 점수 */}
        {/* 히어로 그라디언트 — 데모전용 인디고(brand) 대신 앱 액센트(violet)로 통일(H). */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-strong via-accent to-accent-strong p-5 text-white shadow-lg shadow-accent/25">
          {/* 은은한 광택(캡처 안전 — blur 대신 반투명 원) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-14 -left-8 size-28 rounded-full bg-white/5"
          />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-medium uppercase tracking-wide text-white/70">
                {labels.salon}
              </p>
              <p className="truncate text-base font-bold">{report.salonName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.7rem] font-medium uppercase tracking-wide text-white/70">
                {labels.designer}
              </p>
              <p className="text-sm font-semibold">{report.designerName}</p>
            </div>
          </div>

          <div className="relative mt-5 flex items-center gap-4">
            {report.stateEstimated ? (
              // 디자이너 미기록 → 조작된 점수/등급 대신 정직 문구(측정 안 함).
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/70">
                  {labels.hairState}
                </p>
                <p className="mt-1 text-sm font-medium text-white/90">
                  {labels.stateNote ?? "—"}
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs text-white/70">
                  <CalendarIcon className="size-3.5" />
                  {dateLabel}
                </p>
              </div>
            ) : (
              <>
                <ScoreRing
                  score={score}
                  label={labels.hairState}
                  valueText={`${labels.scoreLabel} · ${labels.grade}`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/70">
                    {labels.hairState}
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white ring-1 ring-inset ring-white/30">
                    {labels.grade}
                  </span>
                  <p className="mt-2 flex items-center gap-1 text-xs text-white/70">
                    <CalendarIcon className="size-3.5" />
                    {dateLabel}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

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

        {/* 지난 방문 기록(재방문 카드) — 값 + 라벨 있을 때만. "관리는 기억력이 아니라 데이터"를 리포트에서 직접 보여줌. */}
        {pastVisit &&
        labels.pastVisit &&
        (pastVisit.lastService || pastVisit.preference || pastVisit.memo) ? (
          <Card>
            <CardContent className="space-y-2.5 p-5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <CalendarIcon className="size-4" />
                {labels.pastVisit.title}
              </p>
              <div className="space-y-2">
                {pastVisit.lastService ? (
                  <Meta
                    label={labels.pastVisit.lastService}
                    value={pastVisit.lastService}
                  />
                ) : null}
                {pastVisit.preference ? (
                  <Meta
                    label={labels.pastVisit.preference}
                    value={pastVisit.preference}
                  />
                ) : null}
                {pastVisit.memo ? (
                  <Meta label={labels.pastVisit.memo} value={pastVisit.memo} />
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* 부위별 레이더 분석 — 헤어 & 얼굴형 DNA(값 있을 때만) */}
        {hasDna && hair ? (
          <HairDna hair={hair} locale={report.locale} labels={labels.dna} />
        ) : null}

        {/* 항목별 상세 분석 — InBody 골격근-지방분석 analog(범위 막대). 행 없으면 생략. */}
        {rangeRows.length > 0 ? (
          <Card>
            <CardContent className="space-y-4 p-5">
              <SectionLabel className="mb-0">{aLabels.title}</SectionLabel>
              <div className="space-y-4">
                {rangeRows.map((row) => (
                  <RangeBar key={row.label} row={row} labels={aLabels} />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* 모발 유형 — InBody CID 유형 analog(유형 레터) */}
        {hasDna ? (
          <HairTypeCard
            title={tLabels.title}
            letter={typeLetter}
            name={typeInfo.name}
            desc={typeInfo.desc}
            rows={rangeRows}
          />
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
          <TextSection
            label={labels.cautions}
            value={report.cautions}
            tone="warn"
          />
        ) : null}

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

        </div>
        {/* /캡처 영역 */}

        {/* 손님 시술 만족도 별점 — 손님만 입력(canRate). 디자이너 뷰는 읽기전용. */}
        <SatisfactionStars
          reportToken={report.reportToken}
          labels={labels.satisfaction}
          demo={demo}
          readOnly={!canRate}
          value={satisfactionScore ?? 0}
        />

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

/**
 * 보강 콜아웃(요청 스타일·고민·주의) — 문단 덩어리 대신 카드+불릿으로 스캔되게.
 * 줄바꿈이 여러 개면 불릿 목록, 한 줄이면 단문. 주의(warn)는 경고 톤.
 */
function TextSection({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  const warn = tone === "warn";
  const items = value
    .split(/\n+/)
    .map((s) => s.replace(/^[-•·]\s*/, "").trim())
    .filter(Boolean);
  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        warn ? "border-destructive/50 bg-card" : "border-border bg-card",
      )}
    >
      <p
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-xs font-semibold",
          warn ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {warn ? <AlertIcon className="size-4" /> : null}
        {label}
      </p>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex gap-2 text-[0.95rem] leading-snug text-foreground"
            >
              <span
                aria-hidden="true"
                className="mt-[0.5rem] size-1 shrink-0 rounded-full bg-current opacity-40"
              />
              {it}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-pretty text-[0.95rem] leading-snug text-foreground">
          {items[0] ?? value}
        </p>
      )}
    </section>
  );
}

/* ── 큰 점수 링 게이지(히어로용 — 흰색 링 on 그라데이션) ── */
function ScoreRing({
  score,
  label,
  valueText,
}: {
  score: number;
  label: string;
  valueText: string;
}) {
  const size = 92;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circ;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      aria-valuetext={valueText}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none text-white">{pct}</span>
        <span className="text-[0.6rem] font-medium text-white/70">/ 100</span>
      </div>
    </div>
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
