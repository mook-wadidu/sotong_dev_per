import { cn } from "@/lib/utils";

/**
 * 소통(Sotong) 브랜드 로고.
 * 심볼 = '대화·통역'을 상징하는 말풍선 + 교환(주고받음) 글리프. currentColor 기반이라
 * text-brand / text-foreground 등 어떤 색에도 따라간다(기본은 브랜드 보라로 쓰길 권장).
 *
 * variant:
 *  - "symbol"   심볼만 (아이콘·파비콘·PWA)
 *  - "wordmark" 글자만 ("소통")
 *  - "full"     심볼 + 소통 + Sotong (헤더·진입·스플래시)
 *
 * 색 처리: 말풍선은 currentColor 채움, 내부 교환선은 면색(흰 배경 위 흰색)으로 파내
 * 단색 채움 위에서도 또렷하다. 모노/브랜드 양쪽에서 동작.
 */
export function LogoSymbol({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("inline-block shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* 말풍선 (브랜드 채움) — 둥근 모서리 + 좌하단 꼬리 */}
      <path
        d="M9 5h22a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H19l-7.5 6.2A1 1 0 0 1 10 33.4V28H9a5 5 0 0 1-5-5V10a5 5 0 0 1 5-5Z"
        fill="currentColor"
      />
      {/* 내부 교환 글리프 — 주고받는 두 방향(번역·소통). 면색으로 파냄. */}
      <g
        stroke="var(--color-background, #fff)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* 위: 오른쪽으로 */}
        <path d="M13.5 14.5h11" />
        <path d="M21.5 11.5 24.5 14.5 21.5 17.5" />
        {/* 아래: 왼쪽으로 */}
        <path d="M26.5 21.5h-11" />
        <path d="M18.5 18.5 15.5 21.5 18.5 24.5" />
      </g>
    </svg>
  );
}

export function Logo({
  variant = "full",
  className,
  symbolClassName,
  title = "소통",
}: {
  variant?: "symbol" | "wordmark" | "full";
  className?: string;
  symbolClassName?: string;
  /** 심볼에 부여할 접근성 라벨(장식이면 비워둠). */
  title?: string;
}) {
  if (variant === "symbol") {
    return <LogoSymbol className={cn("size-9", className)} title={title} />;
  }

  if (variant === "wordmark") {
    return (
      <span
        className={cn(
          "text-xl font-extrabold leading-none tracking-tight text-foreground",
          className,
        )}
      >
        소통
      </span>
    );
  }

  // full
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoSymbol className={cn("size-9 text-brand", symbolClassName)} title={title} />
      <span className="flex flex-col leading-none">
        <span className="text-xl font-extrabold tracking-tight text-foreground">
          소통
        </span>
        <span className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-text">
          Sotong
        </span>
      </span>
    </span>
  );
}
