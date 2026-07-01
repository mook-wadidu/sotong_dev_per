import * as React from "react";
import { IconBase, type IconProps } from "@/components/icons/base";

/**
 * 데모 비트별 전용 단색 라인 아이콘 — 기존 IconBase 규약 그대로
 * (viewBox 0 0 24 24 · stroke=currentColor · fill none · strokeWidth 1.6 · round).
 * 각 비트 내용에 맞춰 직접 제작(재사용 아님). 배지의 글자색(바이올렛)을 그대로 상속.
 */

/** 비트1 — 손님 상담지 입력: 스마트폰 + 폼 라인. */
export const BeatInputIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M8 4.5A2 2 0 0 1 10 2.5h4a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-15Z" />
      <path d="M10.5 7.5h3M10.5 10.5h2" />
      <path d="M11 18h2" />
    </IconBase>
  ),
);
BeatInputIcon.displayName = "BeatInputIcon";

/** 비트2 — 디자이너가 받아 확인: 수신함 트레이 + 아래 화살표. */
export const BeatReceiveIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 3v7.5" />
      <path d="M8.5 8 12 11.5 15.5 8" />
      <path d="M4 13.5v3.5A1.5 1.5 0 0 0 5.5 18.5h13a1.5 1.5 0 0 0 1.5-1.5v-3.5" />
      <path d="M4 13.5h4l1.2 2h5.6l1.2-2H20" />
    </IconBase>
  ),
);
BeatReceiveIcon.displayName = "BeatReceiveIcon";

/** 비트3 — 양방향 번역 상담: 말풍선 2개(서로 마주봄). */
export const BeatTranslateIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12a1.5 1.5 0 0 1 1.5 1.5V9A1.5 1.5 0 0 1 12 10.5H7.5L5 12.6V10.5A1.5 1.5 0 0 1 4 9V5.5Z" />
      <path d="M20 14.5A1.5 1.5 0 0 0 18.5 13H12a1.5 1.5 0 0 0-1.5 1.5V18A1.5 1.5 0 0 0 12 19.5h4.5L19 21.6V19.5A1.5 1.5 0 0 0 20 18V14.5Z" />
    </IconBase>
  ),
);
BeatTranslateIcon.displayName = "BeatTranslateIcon";

/** 비트4 — 시술: 가위. */
export const BeatCutIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M8.3 7.8 19.5 17.5" />
      <path d="M8.3 16.2 19.5 6.5" />
    </IconBase>
  ),
);
BeatCutIcon.displayName = "BeatCutIcon";

/** 비트5 — 리포트 + 별점: 문서 + 별. */
export const BeatReportIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M6.5 3.5H13L18 8.5V18.5A1.5 1.5 0 0 1 16.5 20H6.5A1.5 1.5 0 0 1 5 18.5V5A1.5 1.5 0 0 1 6.5 3.5Z" />
      <path d="M12.8 3.5V8.5H18" />
      <path d="M11.5 11.4l1 2.02 2.23.32-1.61 1.57.38 2.22-2-1.05-2 1.05.38-2.22-1.61-1.57 2.23-.32 1-2.02Z" />
    </IconBase>
  ),
);
BeatReportIcon.displayName = "BeatReportIcon";
