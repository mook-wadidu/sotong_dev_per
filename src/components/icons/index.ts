/**
 * 커스텀 흑백 라인 SVG 아이콘 세트 (Phase 4).
 * - 단색(stroke=currentColor) · viewBox 0 0 24 24 · props {size, className, label}.
 * - catalog id → 아이콘 컴포넌트 매핑은 아래 *_ICONS 레코드 + getXIcon() 헬퍼로.
 * - 사용처(Chip/PictoChip/요약/리포트)는 여기서만 import 한다.
 */
import type * as React from "react";
import type { IconProps } from "./base";
import type {
  FaceShape,
  TreatmentType,
} from "@/lib/domain/types";

export type { IconProps } from "./base";
export { IconBase } from "./base";

import {
  FaceOvalIcon,
  FaceRoundIcon,
  FaceSquareIcon,
  FaceLongIcon,
  FaceHeartIcon,
  FaceDiamondIcon,
} from "./face-shapes";
import {
  CutIcon,
  PermIcon,
  ColorIcon,
  ClinicIcon,
  StylingIcon,
} from "./services";
import {
  NoVolumeIcon,
  FrizzyIcon,
  WideForeheadIcon,
  SensitiveScalpIcon,
  ThinHairIcon,
  DamagedIcon,
  GrayHairIcon,
  BigFaceIcon,
} from "./concerns";
import {
  CareIcon,
  ChatIcon,
  SparkleIcon,
  GlobeIcon,
  AlertIcon,
  PriceTagIcon,
  PhotoIcon,
  CalendarIcon,
  FlagIcon,
  CheckIcon,
  SpinnerIcon,
} from "./misc";

export {
  FaceOvalIcon,
  FaceRoundIcon,
  FaceSquareIcon,
  FaceLongIcon,
  FaceHeartIcon,
  FaceDiamondIcon,
  CutIcon,
  PermIcon,
  ColorIcon,
  ClinicIcon,
  StylingIcon,
  NoVolumeIcon,
  FrizzyIcon,
  WideForeheadIcon,
  SensitiveScalpIcon,
  ThinHairIcon,
  DamagedIcon,
  GrayHairIcon,
  BigFaceIcon,
  CareIcon,
  ChatIcon,
  SparkleIcon,
  GlobeIcon,
  AlertIcon,
  PriceTagIcon,
  PhotoIcon,
  CalendarIcon,
  FlagIcon,
  CheckIcon,
  SpinnerIcon,
};

export type IconComponent = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

/* ── 얼굴형(catalog FaceShape id → 아이콘) ───────────────── */
export const FACE_SHAPE_ICONS: Record<FaceShape, IconComponent> = {
  oval: FaceOvalIcon,
  round: FaceRoundIcon,
  square: FaceSquareIcon,
  long: FaceLongIcon,
  heart: FaceHeartIcon,
  diamond: FaceDiamondIcon,
};
export function getFaceShapeIcon(id: string): IconComponent | undefined {
  return FACE_SHAPE_ICONS[id as FaceShape];
}

/* ── 시술 카테고리(catalog category id → 아이콘) ─────────── */
export const SERVICE_CATEGORY_ICONS: Record<string, IconComponent> = {
  cut: CutIcon,
  perm: PermIcon,
  color: ColorIcon,
  clinic: ClinicIcon,
  styling: StylingIcon,
};
/**
 * 카테고리 id 로 우선 매핑하고, 미스 시 살롱별 id(`${slug}:${catalogId}`)·서비스 id
 * 접두어로도 시도한다(여성컷/남성컷 등 service id 가 cut_* 인 경우 포함).
 */
export function getServiceCategoryIcon(id: string): IconComponent | undefined {
  if (SERVICE_CATEGORY_ICONS[id]) return SERVICE_CATEGORY_ICONS[id];
  const tail = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
  if (SERVICE_CATEGORY_ICONS[tail]) return SERVICE_CATEGORY_ICONS[tail];
  const prefix = tail.split("_")[0];
  return SERVICE_CATEGORY_ICONS[prefix];
}

/* ── 고민(catalog concern id → 아이콘) ──────────────────── */
export const CONCERN_ICONS: Record<string, IconComponent> = {
  no_volume: NoVolumeIcon,
  frizzy: FrizzyIcon,
  wide_forehead: WideForeheadIcon,
  sensitive_scalp: SensitiveScalpIcon,
  thin_hair: ThinHairIcon,
  damaged: DamagedIcon,
  gray_hair: GrayHairIcon,
  big_face: BigFaceIcon,
};
export function getConcernIcon(id: string): IconComponent | undefined {
  return CONCERN_ICONS[id];
}

/* ── 시술 이력 타입(컷/펌/염색/관리 → 아이콘) ───────────── */
export const TREATMENT_TYPE_ICONS: Record<TreatmentType, IconComponent> = {
  cut: CutIcon,
  perm: PermIcon,
  color: ColorIcon,
  care: CareIcon,
};
export function getTreatmentTypeIcon(id: string): IconComponent | undefined {
  return TREATMENT_TYPE_ICONS[id as TreatmentType];
}
