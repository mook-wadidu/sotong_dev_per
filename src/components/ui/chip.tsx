"use client";

import * as React from "react";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Chip — 인테이크의 핵심 탭 컴포넌트. 텍스트 입력 대신 큰 탭 타겟으로 선택.
 * Phase 4: 커스텀 흑백 라인 SVG 아이콘 슬롯 부활 — 텍스트 왼쪽에 단색 아이콘(장식).
 * selectMode 로 시맨틱을 분기:
 *  - "single" → role="radio"  + aria-checked + 원형 도트 인디케이터
 *  - "multi"  → role="checkbox"+ aria-checked + 체크박스 인디케이터
 *  - 미지정    → 토글 버튼(aria-pressed) — 단독 토글용 (하위호환)
 * 색 외 신호(테두리/링/인디케이터)와 focus-visible 링으로 a11y 확보.
 */
export interface ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  selected?: boolean;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  /** 커스텀 흑백 SVG 아이콘(장식). 텍스트 라벨 왼쪽에 표시. */
  icon?: React.ReactNode;
  showCheck?: boolean;
  selectMode?: "single" | "multi";
}

const chipFocus =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      selected,
      label,
      sublabel,
      icon,
      showCheck = true,
      selectMode,
      className,
      ...props
    },
    ref,
  ) => {
    const role =
      selectMode === "single"
        ? "radio"
        : selectMode === "multi"
          ? "checkbox"
          : undefined;
    const a11y = role
      ? { role, "aria-checked": !!selected }
      : { "aria-pressed": !!selected };

    return (
      <button
        ref={ref}
        type="button"
        {...a11y}
        className={cn(
          "group relative flex min-h-13 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-[background-color,border-color,box-shadow] active:scale-[0.98]",
          chipFocus,
          // 선택 신호: 채움(soft 배경) + 두꺼운 외곽선(잉크) — 색이 아니라 굵기로 구분
          selected
            ? "border-accent bg-accent-soft ring-1 ring-accent"
            : "border-border bg-card hover:border-foreground/15 hover:bg-muted hover:shadow-sm",
          className,
        )}
        {...props}
      >
        {icon ? (
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center text-foreground [&>svg]:size-6"
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[0.95rem] leading-tight text-foreground",
              // 선택 시 굵기로 강조
              selected ? "font-semibold" : "font-medium",
            )}
          >
            {label}
          </span>
          {sublabel ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {sublabel}
            </span>
          ) : null}
        </span>
        {showCheck ? (
          <ChipIndicator selected={!!selected} mode={selectMode} />
        ) : null}
      </button>
    );
  },
);
Chip.displayName = "Chip";

/** 선택 인디케이터 — single=원형 도트, multi/기본=체크 사각 */
function ChipIndicator({
  selected,
  mode,
}: {
  selected: boolean;
  mode?: "single" | "multi";
}) {
  if (mode === "single") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-accent-strong" : "border-border",
        )}
      >
        <span
          className={cn(
            "size-2.5 rounded-full transition-transform",
            selected ? "scale-100 bg-accent-strong" : "scale-0 bg-transparent",
          )}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        selected
          ? "border-accent-strong bg-accent-strong text-accent-strong-foreground"
          : "border-border bg-transparent text-transparent",
      )}
    >
      <CheckIcon className="size-3.5" strokeWidth={3} />
    </span>
  );
}

/** 작은 칩 (얼굴형 등 그리드용) — Phase 4: 커스텀 흑백 아이콘 중심 + 라벨 아래. */
export interface PictoChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  selected?: boolean;
  label: React.ReactNode;
  /** 커스텀 흑백 SVG 아이콘(장식) — 라벨 위 중앙에 표시. */
  icon?: React.ReactNode;
  selectMode?: "single" | "multi";
}

export const PictoChip = React.forwardRef<HTMLButtonElement, PictoChipProps>(
  ({ selected, label, icon, selectMode, className, ...props }, ref) => {
    const role =
      selectMode === "single"
        ? "radio"
        : selectMode === "multi"
          ? "checkbox"
          : undefined;
    const a11y = role
      ? { role, "aria-checked": !!selected }
      : { "aria-pressed": !!selected };

    return (
      <button
        ref={ref}
        type="button"
        {...a11y}
        className={cn(
          "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-[background-color,border-color,box-shadow] active:scale-[0.97]",
          chipFocus,
          // 선택 시 색 외 신호: 두꺼운 링 (ring-2)
          selected
            ? "border-accent bg-accent-soft ring-2 ring-accent"
            : "border-border bg-card hover:border-foreground/15 hover:bg-muted hover:shadow-sm",
          className,
        )}
        {...props}
      >
        {/* 색 외 신호: 모서리 체크 배지 (단색 중립 글리프) */}
        {selected ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-accent-strong text-accent-strong-foreground"
          >
            <CheckIcon className="size-2.5" strokeWidth={3} />
          </span>
        ) : null}
        {icon ? (
          <span
            aria-hidden="true"
            className="flex items-center justify-center text-foreground [&>svg]:size-8"
          >
            {icon}
          </span>
        ) : null}
        <span
          className={cn(
            "text-center text-sm leading-tight text-foreground",
            selected ? "font-semibold" : "font-medium",
          )}
        >
          {label}
        </span>
      </button>
    );
  },
);
PictoChip.displayName = "PictoChip";
