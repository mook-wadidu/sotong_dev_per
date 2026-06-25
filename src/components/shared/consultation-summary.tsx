import { GlobeIcon, PhotoIcon } from "@/components/icons";
import { Card, CardContent, Divider } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ConsultationStatus } from "@/lib/domain/types";

/**
 * ConsultationSummary — 상담 정보 공유 카드(흑백, 목업① 레이아웃).
 *
 * 디자이너(ko)·손님(손님언어) 양쪽이 재사용한다. 컴포넌트 자체는 **언어 중립**:
 * 모든 표시 문자열(언어명·시술 라벨·성별 등)과 i18n 라벨(`labels`)은
 * 호출부가 이미 해석해서 props 로 넘긴다. 순수 프레젠테이션이라 서버/클라 양쪽 호환.
 *
 * 레이아웃: 라벨/값 행 카드 + 참고 이미지 grid + 하단 흑백 진행 스테퍼
 * (예약문의[intake] → 상담진행[consulting/in_service] → 방문완료[completed]).
 * 현재 단계 강조는 색이 아니라 채움(bg-foreground)·굵기·테두리로 표현한다.
 * 값이 없는 행은 생략한다(성별·나이는 둘 다 없으면 행 자체 생략).
 */

export interface ConsultationSummaryLabels {
  /** 카드 제목 (예: "상담 정보") */
  title: string;
  /** 언어 행 라벨 */
  language: string;
  /** 방문 목적(시술) 행 라벨 */
  purpose: string;
  /** 원하는 스타일 행 라벨 */
  style: string;
  /** 참고 이미지 섹션 라벨 */
  photos: string;
  /** 추가 메모 행 라벨 */
  memo: string;
  /** 성별 행 라벨 */
  gender: string;
  /** 나이 행 라벨 */
  age: string;
  /** 나이 값 포맷 — "{age}" 플레이스홀더 포함(예: "{age}세"). 없으면 숫자만. */
  ageValue?: string;
  /** 진행 스테퍼 라벨 */
  step: {
    /** 접근성 progressbar 이름 (예: "진행 상황") */
    label: string;
    /** 1단계: 예약문의(intake) */
    booked: string;
    /** 2단계: 상담진행(consulting/in_service) */
    consulting: string;
    /** 3단계: 방문완료(completed) */
    done: string;
  };
}

export interface ConsultationSummaryProps {
  /** 손님 언어명(이미 해석됨, 예 "English"/"日本語"/"한국어") */
  language: string;
  /** 방문 목적 — 시술 라벨 배열(호출부가 locale 해석) */
  services: string[];
  /** 원하는 스타일 텍스트 */
  styleText?: string;
  /** 참고 이미지 dataURL/URL 배열 */
  photos?: string[];
  /** 추가 메모 */
  memo?: string;
  /** 성별 라벨(이미 해석됨, 예 "여성"/"Female") */
  gender?: string;
  /** 나이 */
  age?: number;
  /** 상담 상태 — 스테퍼 단계 매핑용 */
  status: ConsultationStatus;
  /** i18n 라벨(호출부 NS 에서 주입) */
  labels: ConsultationSummaryLabels;
  className?: string;
}

/** ConsultationStatus → 스테퍼 현재 단계(1-based, 3단계). cancelled 는 intake 취급. */
function stepIndex(status: ConsultationStatus): number {
  switch (status) {
    case "intake":
    case "cancelled":
      return 1;
    case "consulting":
    case "in_service":
      return 2;
    case "completed":
      return 3;
    default:
      return 1;
  }
}

export function ConsultationSummary({
  language,
  services,
  styleText,
  photos,
  memo,
  gender,
  age,
  status,
  labels,
  className,
}: ConsultationSummaryProps) {
  const purposeText = services.filter(Boolean).join(", ");
  const styleTrimmed = styleText?.trim();
  const memoTrimmed = memo?.trim();
  const photoList = (photos ?? []).filter(Boolean);

  const ageText =
    typeof age === "number" && Number.isFinite(age)
      ? labels.ageValue
        ? labels.ageValue.replace("{age}", String(age))
        : String(age)
      : undefined;
  const hasDemographics = Boolean(gender?.trim()) || Boolean(ageText);

  return (
    <section className={cn("space-y-3", className)} aria-label={labels.title}>
      {/* 라벨/값 행 카드 */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <DetailRow
            label={labels.language}
            value={
              <span className="inline-flex items-center gap-1.5">
                <GlobeIcon className="size-4 text-muted-foreground" />
                {language}
              </span>
            }
          />

          {purposeText ? (
            <>
              <Divider />
              <DetailRow label={labels.purpose} value={purposeText} />
            </>
          ) : null}

          {styleTrimmed ? (
            <>
              <Divider />
              <DetailRow label={labels.style} value={styleTrimmed} />
            </>
          ) : null}

          {memoTrimmed ? (
            <>
              <Divider />
              <DetailRow label={labels.memo} value={memoTrimmed} />
            </>
          ) : null}

          {hasDemographics ? (
            <>
              <Divider />
              <div className="grid grid-cols-2 gap-3">
                {gender?.trim() ? (
                  <DetailRow label={labels.gender} value={gender.trim()} />
                ) : null}
                {ageText ? (
                  <DetailRow label={labels.age} value={ageText} />
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* 참고 이미지 */}
      {photoList.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <PhotoIcon className="size-4" />
            {labels.photos}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photoList.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`${labels.photos} ${i + 1}`}
                className="aspect-square w-full rounded-xl border border-border object-cover"
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* 흑백 진행 스테퍼 */}
      <SummaryStepper
        current={stepIndex(status)}
        labels={labels.step}
      />
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[0.8rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {value}
      </div>
    </div>
  );
}

/**
 * 흑백 3단계 스테퍼. 색 대신:
 * - 완료/현재 노드: 채움(bg-foreground) + 흰 글자, 미래 노드: 테두리만.
 * - 현재 라벨: 굵게(text-foreground), 그 외: muted.
 * - 연결선: 완료 구간 진하게(bg-foreground), 미래 구간 옅게.
 */
function SummaryStepper({
  current,
  labels,
}: {
  current: number; // 1-based
  labels: ConsultationSummaryLabels["step"];
}) {
  const steps = [labels.booked, labels.consulting, labels.done];
  const total = steps.length;

  return (
    <div
      role="progressbar"
      aria-label={labels.label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`${steps[current - 1] ?? ""} (${current} / ${total})`}
      className="rounded-xl border border-border bg-card p-4"
    >
      <ol className="flex items-start">
        {steps.map((label, i) => {
          const stepNo = i + 1;
          const isDone = stepNo < current;
          const isCurrent = stepNo === current;
          const isLast = i === total - 1;
          return (
            <li
              key={i}
              className="flex flex-1 flex-col items-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex w-full items-center">
                {/* 좌측 연결선(첫 노드 제외) */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.5 flex-1",
                    i === 0
                      ? "opacity-0"
                      : stepNo <= current
                        ? "bg-foreground"
                        : "bg-muted-foreground/30",
                  )}
                />
                {/* 노드 */}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    isDone || isCurrent
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground/40 bg-card text-muted-foreground",
                    isCurrent && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                  )}
                >
                  {stepNo}
                </span>
                {/* 우측 연결선(마지막 노드 제외) */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.5 flex-1",
                    isLast
                      ? "opacity-0"
                      : stepNo < current
                        ? "bg-foreground"
                        : "bg-muted-foreground/30",
                  )}
                />
              </div>
              <span
                className={cn(
                  "mt-1.5 text-center text-[11px] leading-tight",
                  isCurrent
                    ? "font-bold text-foreground"
                    : isDone
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
