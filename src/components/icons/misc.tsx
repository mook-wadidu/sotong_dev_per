import * as React from "react";
import { IconBase, type IconProps } from "./base";

/**
 * 보조/의미 아이콘 — 홈·요약·리포트의 의미 자리용(흑백 라인, 과하지 않게).
 */

/** 케어(클리닉 이력) — 잎/영양 (treatmentHistory 'care' 용) */
export const CareIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M20 4c0 7-4.5 11-9 11a5 5 0 0 1-5-5C6 6.5 12 4 20 4Z" />
      <path d="M6 20c1-5 3.5-8.5 9-11" />
    </IconBase>
  ),
);
CareIcon.displayName = "CareIcon";

/** 말풍선 — 상담/번역 스레드 */
export const ChatIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 14.5v-9Z" />
      <path d="M8 8.5h8M8 11.5h5" />
    </IconBase>
  ),
);
ChatIcon.displayName = "ChatIcon";

/** 반짝(AI/요약 강조) */
export const SparkleIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 3c.6 3.8 1.9 5.4 6 6-4.1.6-5.4 2.2-6 6-.6-3.8-1.9-5.4-6-6 4.1-.6 5.4-2.2 6-6Z" />
      <path d="M18.5 14c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" />
    </IconBase>
  ),
);
SparkleIcon.displayName = "SparkleIcon";

/** 환영/언어(글로브) — 홈·언어선택 */
export const GlobeIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.4 3.6 5.4 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.4-3.6-8.5S9.6 5.9 12 3.5Z" />
    </IconBase>
  ),
);
GlobeIcon.displayName = "GlobeIcon";

/** 주의/경고(삼각형 느낌표) — 알레르기·주의 강조 */
export const AlertIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.7" r=".6" fill="currentColor" stroke="none" />
    </IconBase>
  ),
);
AlertIcon.displayName = "AlertIcon";

/** 가격/예상가 — 태그 */
export const PriceTagIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M4 11.2V5a1 1 0 0 1 1-1h6.2a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0L4.6 13.6A2 2 0 0 1 4 11.2Z" />
      <circle cx="8.5" cy="8.5" r="1.3" />
    </IconBase>
  ),
);
PriceTagIcon.displayName = "PriceTagIcon";

/** 사진 — 스타일 참고 사진 */
export const PhotoIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.4" />
      <path d="m4.5 17 4.5-4.5c.6-.6 1.5-.6 2.1 0l3.4 3.4M13 14.5l2-2c.6-.6 1.5-.6 2.1 0l3.4 3.4" />
    </IconBase>
  ),
);
PhotoIcon.displayName = "PhotoIcon";

/** 캘린더 — 다음 방문 권장 */
export const CalendarIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 9.5h16M8 3.5v4M16 3.5v4" />
    </IconBase>
  ),
);
CalendarIcon.displayName = "CalendarIcon";

/** 체크 — 선택/완료 인디케이터(Chip·Checkbox). strokeWidth 는 호출부가 굵게 줄 수 있음. */
export const CheckIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </IconBase>
  ),
);
CheckIcon.displayName = "CheckIcon";

/** 로딩 스피너 — 호(arc) 1개, 호출부에서 animate-spin 적용. */
export const SpinnerIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </IconBase>
  ),
);
SpinnerIcon.displayName = "SpinnerIcon";

/** 깃발/국적 — 손님 국적 */
export const FlagIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M6 3v18" />
      <path d="M6 4.5h11l-2.2 3.3L17 11H6" />
    </IconBase>
  ),
);
FlagIcon.displayName = "FlagIcon";
