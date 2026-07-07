"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * C1 언어 선택 버튼 — 큰 탭 타겟, 자기 언어로 표기(native label).
 * 세련화: 트레일링 셰브론(어포던스) + selected(추천/선택) 바이올렛 상태 + badge 슬롯.
 */
export function LanguageButton({
  nativeLabel,
  subLabel,
  selected = false,
  badge,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  nativeLabel: string;
  subLabel?: string;
  /** 선택/추천 강조 — 바이올렛 채움 + 링. */
  selected?: boolean;
  /** 우측 상단 배지(예: "추천"). */
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left shadow-sm transition-all active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "border-accent bg-accent-soft ring-1 ring-accent shadow-md"
          : "border-border bg-card hover:border-accent hover:bg-accent-soft hover:shadow-md",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-lg font-semibold leading-tight text-foreground">
            {nativeLabel}
          </span>
          {badge ? (
            <span className="rounded-full bg-accent-strong px-2 py-0.5 text-[0.65rem] font-bold leading-none text-accent-strong-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        {subLabel ? (
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {subLabel}
          </span>
        ) : null}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={cn(
          "size-5 shrink-0 transition-all group-hover:translate-x-0.5",
          selected ? "text-accent-text" : "text-muted-foreground",
        )}
      >
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
