import * as React from "react";
import { IconBase, type IconProps } from "./base";

/**
 * 평소 고민 8종 — 미니멀 상징(흑백 라인).
 * no_volume / frizzy / wide_forehead / sensitive_scalp /
 * thin_hair / damaged / gray_hair / big_face.
 */

/** 볼륨 없음 — 납작하게 눌린 형태(아래로 향한 갈매기) */
export const NoVolumeIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M4 9h16" />
      <path d="M6 13.5c2 1.6 4 2.4 6 2.4s4-.8 6-2.4" />
      <path d="M12 16v3.5M12 19.5l-2-2M12 19.5l2-2" />
    </IconBase>
  ),
);
NoVolumeIcon.displayName = "NoVolumeIcon";

/** 곱슬 심함 — 촘촘한 컬 라인 */
export const FrizzyIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M5 7c1.5 0 1.5 2.6 3 2.6S9.5 7 11 7s1.5 2.6 3 2.6S15.5 7 17 7s1.5 2.6 3 2.6" />
      <path d="M5 13c1.5 0 1.5 2.6 3 2.6S9.5 13 11 13s1.5 2.6 3 2.6S15.5 13 17 13s1.5 2.6 3 2.6" />
      <path d="M7 19c1.5 0 1.5 1.8 3 1.8S11.5 19 13 19" />
    </IconBase>
  ),
);
FrizzyIcon.displayName = "FrizzyIcon";

/** 이마 넓음 — 얼굴 윤곽 + 위쪽으로 후퇴한 헤어라인 */
export const WideForeheadIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M5 11c0-4.4 3.1-7.5 7-7.5s7 3.1 7 7.5c0 4.7-2.9 9.5-7 9.5S5 15.7 5 11Z" />
      {/* 높이 올라간 헤어라인 */}
      <path d="M6.5 8.5C8 7 9.9 6.2 12 6.2s4 .8 5.5 2.3" />
      {/* 넓은 이마를 가리키는 양방향 화살(눈 위 공간) */}
      <path d="M9 11.3h6" />
      <path d="M9 11.3l1-1M9 11.3l1 1M15 11.3l-1-1M15 11.3l-1 1" />
    </IconBase>
  ),
);
WideForeheadIcon.displayName = "WideForeheadIcon";

/** 두피 예민 — 물결 두피선 + 경고 점 */
export const SensitiveScalpIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      {/* 두피(반원) */}
      <path d="M4 15a8 8 0 0 1 16 0" />
      {/* 자극(상승하는 작은 선들) */}
      <path d="M8 11.5V8.5M12 10.5V6.5M16 11.5V8.5" />
      {/* 예민 표시(둥근 점) */}
      <circle cx="12" cy="18.5" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  ),
);
SensitiveScalpIcon.displayName = "SensitiveScalpIcon";

/** 숱 적음 — 듬성한 머리카락 가닥 */
export const ThinHairIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M4 20h16" />
      <path d="M7 20c0-4 .5-7 1-10" />
      <path d="M12 20c0-5 .4-8 1.2-12" />
      <path d="M17 20c0-3.5.4-6 .8-8.5" />
    </IconBase>
  ),
);
ThinHairIcon.displayName = "ThinHairIcon";

/** 손상 — 갈라진 모발 끝(스플릿 엔드) */
export const DamagedIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 3v9" />
      {/* 갈라진 끝 */}
      <path d="M12 12 9 21" />
      <path d="M12 12 15 21" />
      <path d="M12 12l-.4 9M12 12l.4 9" />
      {/* 끊김 표시(작은 가로 틈) */}
      <path d="M10.5 7.5h3" />
    </IconBase>
  ),
);
DamagedIcon.displayName = "DamagedIcon";

/** 흰머리 — 머리카락 한 가닥에 강조 표식(반짝) */
export const GrayHairIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M6 21c0-6 1-11 3-15" />
      <path d="M12 21c0-7 1-12 3-16" />
      {/* 흰머리 강조(반짝 4각별) */}
      <path d="M18 7v4M16 9h4M16.6 7.6l2.8 2.8M19.4 7.6l-2.8 2.8" />
    </IconBase>
  ),
);
GrayHairIcon.displayName = "GrayHairIcon";

/** 얼굴 커 보임 — 얼굴 윤곽 + 좌우 축소 화살 */
export const BigFaceIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 3.5c3.6 0 6 2.9 6 6.5 0 4.6-2.7 10.5-6 10.5S6 14.6 6 10c0-3.6 2.4-6.5 6-6.5Z" />
      {/* 좁히는(안쪽) 화살 */}
      <path d="M3.5 12h2.5M6 12l-1.4-1.2M6 12l-1.4 1.2" />
      <path d="M20.5 12H18M18 12l1.4-1.2M18 12l1.4 1.2" />
    </IconBase>
  ),
);
BigFaceIcon.displayName = "BigFaceIcon";
