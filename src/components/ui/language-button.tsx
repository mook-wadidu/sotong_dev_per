"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * C1 언어 선택 버튼 — 큰 탭 타겟, 자기 언어로 표기(native label).
 * Phase 3: 국기 이모지/화살표 글리프 제거 — 텍스트만.
 */
export function LanguageButton({
  nativeLabel,
  subLabel,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  nativeLabel: string;
  subLabel?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "group flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-[background-color,border-color] hover:border-accent hover:bg-accent-soft active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    >
      <span className="flex-1">
        <span className="block text-lg font-semibold leading-tight text-foreground">
          {nativeLabel}
        </span>
        {subLabel ? (
          <span className="block text-sm text-muted-foreground">
            {subLabel}
          </span>
        ) : null}
      </span>
    </button>
  );
}
