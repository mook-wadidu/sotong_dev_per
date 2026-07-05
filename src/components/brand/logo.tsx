import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * 소통(Sotong) 브랜드 로고.
 * 심볼 = 두 개의 겹친 말풍선(파랑+보라) 컬러 로고(`/logo.png`).
 *
 * variant:
 *  - "symbol"   심볼만 (아이콘·파비콘·PWA)
 *  - "wordmark" 글자만 ("소통")
 *  - "full"     심볼 + 소통 + Sotong (헤더·진입·스플래시)
 *
 * 컬러 PNG라 currentColor 틴트는 적용되지 않는다(전달된 text-* 클래스는 무해).
 * 크기는 size-* 등 className 으로 제어(정사각 박스, object-contain 으로 비율 유지).
 */
export function LogoSymbol({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt={title ?? ""}
      width={40}
      height={40}
      priority
      unoptimized
      aria-hidden={title ? undefined : true}
      className={cn("inline-block shrink-0 object-contain", className)}
    />
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
