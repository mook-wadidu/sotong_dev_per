import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 운영자(어드민) 셸 — 데스크톱 우선, 모바일은 세로 스택.
 * 손님/디자이너의 MobileFrame(max-w-md) 과 달리 넓은 폭(max-w-6xl)을 쓴다.
 */
export function AdminShell({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 헤더 우측 액션 영역 (필터/내보내기 등) */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-dvh bg-background", className)}>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            {title ? (
              <h1 className="truncate text-lg font-semibold leading-tight">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="truncate text-sm text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

/** 어드민 섹션 블록 — 제목 + 본문. 카드형 그룹. */
export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8 last:mb-0", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-base font-semibold leading-tight">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
