import * as React from "react";
import { IconBase, type IconProps } from "./base";

/**
 * 시술 카테고리 5종 — 미용 도구 상징(흑백 라인).
 * 컷=가위 / 펌=웨이브·롤 / 염색=브러시+튜브 / 클리닉=물방울 / 스타일링=드라이어.
 */

/** 컷 — 가위 (두 손잡이 고리 + 날) */
export const CutIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M8.2 8.2 20 17" />
      <path d="M8.2 15.8 20 7" />
      <path d="m13.5 12 1.6-1.2" />
    </IconBase>
  ),
);
CutIcon.displayName = "CutIcon";

/** 펌 — 컬/웨이브 라인 (롤로 말린 머릿결) */
export const PermIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M5 6c2.2 0 2.2 3 4.4 3S11.6 6 13.8 6 16 9 18.2 9" />
      <path d="M5 12c2.2 0 2.2 3 4.4 3s2.2-3 4.4-3 2.2 3 4.4 3" />
      {/* 롤(원통)로 말린 끝 */}
      <circle cx="9" cy="18" r="2.3" />
      <path d="M9 15.7v4.6" />
    </IconBase>
  ),
);
PermIcon.displayName = "PermIcon";

/** 염색 — 컬러 브러시 + 튜브 */
export const ColorIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      {/* 브러시 손잡이 + 헤드 */}
      <path d="M4 20 13 11" />
      <path d="M12 8.5 15.5 12l1.7-1.7c.6-.6.6-1.6 0-2.2l-1.3-1.3c-.6-.6-1.6-.6-2.2 0L12 8.5Z" />
      {/* 브러시 모(빗살) */}
      <path d="M13 11.8 11 13.8" />
      <path d="M11.4 10.2 9.4 12.2" />
      {/* 튜브(약제) */}
      <path d="M17 17.5h4M19 17.5V21" />
    </IconBase>
  ),
);
ColorIcon.displayName = "ColorIcon";

/** 클리닉 — 물방울(트리트먼트 영양) */
export const ClinicIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 3.5c2.8 3.4 5.5 6.4 5.5 9.8a5.5 5.5 0 1 1-11 0c0-3.4 2.7-6.4 5.5-9.8Z" />
      <path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" />
    </IconBase>
  ),
);
ClinicIcon.displayName = "ClinicIcon";

/** 스타일링 — 헤어 드라이어 */
export const StylingIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      {/* 바디(원형) */}
      <path d="M4 8.5a4 4 0 0 1 4-4h6a4 4 0 0 1 0 8H8a4 4 0 0 1-4-4Z" />
      {/* 손잡이 */}
      <path d="M10.5 12.2 9 19.5" />
      <path d="M9 19.5h4" />
      {/* 노즐 끝 + 바람 */}
      <path d="M18 8.5h2.5" />
      <path d="M18 6.2h1.8M18 10.8h1.8" />
    </IconBase>
  ),
);
StylingIcon.displayName = "StylingIcon";
