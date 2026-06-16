import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 모바일 웹앱 셸. 데스크톱에서도 가운데 한 컬럼(max-w)으로 모바일 뷰를 유지한다.
 * QR로 들어오는 손님·카톡 링크로 들어오는 디자이너 둘 다 폰 우선.
 */
export function MobileFrame({
  className,
  children,
  tone = "default",
  lang,
}: {
  className?: string;
  children: React.ReactNode;
  tone?: "default" | "muted";
  /**
   * 콘텐츠 언어가 라우트 locale 과 다를 때 컨테이너 lang 을 덮어쓴다
   * (예: ja 리포트가 /ko URL 로 열릴 때 — 자형/스크린리더 정확도, AUDIT C4).
   */
  lang?: string;
}) {
  return (
    <div
      lang={lang}
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-md flex-col",
        tone === "muted" ? "bg-muted" : "bg-background",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 상단 헤더 — 살롱 로고/타이틀 + 옵션 좌측 액션(뒤로) */
export function ScreenHeader({
  title,
  subtitle,
  leading,
  trailing,
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-md",
        className,
      )}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        {title ? (
          <div className="truncate text-[0.95rem] font-semibold leading-tight">
            {title}
          </div>
        ) : null}
        {subtitle ? (
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}

/** 스크롤되는 본문 */
export function ScreenBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main className={cn("flex-1 px-4 py-5", className)}>{children}</main>
  );
}

/** 하단 고정 액션 바 (CTA) */
export function ScreenFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <footer
      className={cn(
        "sticky bottom-0 z-20 border-t border-border/70 bg-background/90 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </footer>
  );
}
