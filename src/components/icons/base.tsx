import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 커스텀 흑백 라인 아이콘 공통 베이스 (Phase 4).
 *
 * 원칙
 * - 단색: stroke=currentColor, fill=none 위주 (글자색을 따라감 → 흑백 톤 일관).
 * - 일관 stroke-width(기본 1.6), viewBox 0 0 24 24, round cap/join.
 * - 장식용이면 aria-hidden(기본 true). 의미 단독이면 호출부가 `label` 전달 → role="img"+aria-label.
 * - 크기: `size`(px, 기본 24) 또는 className(`size-*`). className 우선.
 */
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** px 단위 가로/세로. className 으로 크기를 줄 경우 생략 가능. */
  size?: number;
  /** 의미를 단독으로 전달하는 아이콘이면 접근성 라벨을 준다(없으면 장식 취급 aria-hidden). */
  label?: string;
}

/**
 * 모든 아이콘이 공유하는 <svg> 래퍼.
 * children 에 path/line 등을 넘긴다.
 */
export const IconBase = React.forwardRef<
  SVGSVGElement,
  IconProps & { children: React.ReactNode }
>(({ size = 24, label, className, children, strokeWidth, ...props }, ref) => {
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true, focusable: false } as const);
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("inline-block shrink-0", className)}
      {...a11y}
      {...props}
    >
      {children}
    </svg>
  );
});
IconBase.displayName = "IconBase";
