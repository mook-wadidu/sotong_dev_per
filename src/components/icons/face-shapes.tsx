import * as React from "react";
import { IconBase, type IconProps } from "./base";

/**
 * 얼굴형 6종 — 윤곽 라인만(흑백). 각 형태의 특징을 단순 path 로 표현.
 * 중심을 (12, 12), 세로로 약간 긴 비례를 기본으로 잡아 윤곽 차이를 강조.
 */

/** 계란형 — 위가 넓고 턱이 부드럽게 좁아지는 타원 */
export const FaceOvalIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 3c3.6 0 6 2.9 6 6.5 0 4.6-2.7 11-6 11s-6-6.4-6-11C6 5.9 8.4 3 12 3Z" />
    </IconBase>
  ),
);
FaceOvalIcon.displayName = "FaceOvalIcon";

/** 둥근형 — 가로세로 비슷한 원 */
export const FaceRoundIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <circle cx="12" cy="12" r="8.5" />
    </IconBase>
  ),
);
FaceRoundIcon.displayName = "FaceRoundIcon";

/** 각진형 — 모서리가 살짝 둥근 사각(턱선 강조) */
export const FaceSquareIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M6 6.5C6 4.6 7.3 4 9 4h6c1.7 0 3 .6 3 2.5v9c0 2.6-2.7 4.5-6 4.5s-6-1.9-6-4.5v-9Z" />
    </IconBase>
  ),
);
FaceSquareIcon.displayName = "FaceSquareIcon";

/** 긴형 — 세로로 길쭉한 타원 */
export const FaceLongIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 2.5c3 0 5 2.2 5 5v8c0 4-2.2 6-5 6s-5-2-5-6v-8c0-2.8 2-5 5-5Z" />
    </IconBase>
  ),
);
FaceLongIcon.displayName = "FaceLongIcon";

/** 하트형 — 넓은 이마(살짝 패인 헤어라인) + 뾰족한 턱 */
export const FaceHeartIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 6.2C11 5 9.4 4.2 7.8 4.2 5.6 4.2 4 5.7 4 7.8c0 1 .3 2 .9 3.2C6.2 13.7 9 17.6 12 21c3-3.4 5.8-7.3 7.1-10 .6-1.2.9-2.2.9-3.2 0-2.1-1.6-3.6-3.8-3.6-1.6 0-3.2.8-4.2 2Z" />
    </IconBase>
  ),
);
FaceHeartIcon.displayName = "FaceHeartIcon";

/** 다이아몬드형 — 광대 넓고 이마·턱 좁은 마름모 */
export const FaceDiamondIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => (
    <IconBase ref={ref} {...props}>
      <path d="M12 3c1.4 2 2.6 3.4 4.6 5.2 1.4 1.2 2.4 2.2 2.4 3.4 0 1.6-1 2.8-2.6 4.4C14.2 18 13 19.4 12 21c-1-1.6-2.2-3-4.4-5C6 14.4 5 13.2 5 11.6c0-1.2 1-2.2 2.4-3.4C9.4 6.4 10.6 5 12 3Z" />
    </IconBase>
  ),
);
FaceDiamondIcon.displayName = "FaceDiamondIcon";
