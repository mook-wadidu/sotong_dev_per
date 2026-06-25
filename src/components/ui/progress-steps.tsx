import { cn } from "@/lib/utils";

/** 인테이크 다단계 진행 표시 — 가는 막대 세그먼트 */
export function ProgressSteps({
  total,
  current,
  label,
  valueText,
  className,
}: {
  total: number;
  current: number; // 1-based
  /** progressbar 의 접근성 이름 (예: "인테이크 진행") */
  label?: string;
  /** aria-valuetext 오버라이드. 미지정 시 "current / total" */
  valueText?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={valueText ?? `${current} / ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < current - 1;
        const isCurrent = i === current - 1;
        return (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-full transition-all",
              // 현재 단계는 더 두껍게(흑백 신호 강화) — "지금 몇 단계"가 또렷.
              isCurrent
                ? "h-2 bg-accent-strong"
                : isDone
                  ? "h-1.5 bg-accent"
                  : // 미완료 — 배경 대비 ≥3:1 (WCAG 1.4.11)
                    "h-1.5 bg-muted-foreground/35",
            )}
          />
        );
      })}
    </div>
  );
}
