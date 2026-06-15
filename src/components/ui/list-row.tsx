"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 목록 행 — 좌측 리딩(아바타/아이콘), 제목/부제, 우측 메타/배지.
 * 클릭 가능하면 button, 아니면 div. 인박스·문의 목록 등에 사용.
 */
export interface ListRowProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 우측 메타(시간/배지/화살표 등) */
  trailing?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  /** asChild 처럼 children 으로 링크 래핑하고 싶을 때 */
  as?: "button" | "div";
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  className,
  as,
}: ListRowProps) {
  const interactive = !!onClick || as === "button";
  const inner = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {title}
        </div>
        {subtitle ? (
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {trailing}
        </div>
      ) : null}
    </>
  );

  const base =
    "flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left";

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          base,
          "outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]",
          className,
        )}
      >
        {inner}
      </button>
    );
  }

  return <div className={cn(base, className)}>{inner}</div>;
}
