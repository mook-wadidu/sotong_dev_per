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
              "h-1.5 flex-1 rounded-full transition-colors",
              isCurrent
                ? "bg-accent-strong"
                : isDone
                  ? "bg-accent"
                  : // 미완료 — 배경 대비 ≥3:1 (WCAG 1.4.11)
                    "bg-muted-foreground/35",
            )}
          />
        );
      })}
    </div>
  );
}
