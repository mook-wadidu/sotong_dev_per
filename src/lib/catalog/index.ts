import type { Locale } from "@/lib/domain/types";
import {
  ALL_SERVICES,
  CONCERNS,
  CROWN_VOLUME,
  FACE_SHAPES,
  HAIR_DENSITY,
  HAIR_HISTORY,
  HAIR_TYPE,
  PRODUCTS,
  QUICK_REPLIES,
  SERVICE_CATEGORIES,
  TIME_PRESETS,
  type CatalogItem,
} from "./data";

/** Intl 로케일 태그 매핑 (Locale → BCP-47) */
const INTL_LOCALE: Record<Locale, string> = {
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
  zh: "zh-CN",
};

export * from "./data";

function index(items: CatalogItem[]) {
  return new Map(items.map((i) => [i.id, i]));
}

const SERVICE_MAP = index(ALL_SERVICES);
const CONCERN_MAP = index(CONCERNS);
const HISTORY_MAP = index(HAIR_HISTORY);
const FACE_MAP = index(FACE_SHAPES);

/** id 목록 → 해당 로케일 라벨 목록 */
export function labelsFor(
  map: Map<string, CatalogItem>,
  ids: string[],
  locale: Locale,
): string[] {
  return ids
    .map((id) => map.get(id))
    .filter((x): x is CatalogItem => Boolean(x))
    .map((x) => x.label[locale] ?? x.label.ko);
}

export const serviceLabels = (ids: string[], locale: Locale) =>
  labelsFor(SERVICE_MAP, ids, locale);
export const concernLabels = (ids: string[], locale: Locale) =>
  labelsFor(CONCERN_MAP, ids, locale);
export const hairHistoryLabels = (ids: string[], locale: Locale) =>
  labelsFor(HISTORY_MAP, ids, locale);

export function faceShapeLabel(id: string | undefined, locale: Locale) {
  if (!id) return undefined;
  const item = FACE_MAP.get(id);
  return item ? (item.label[locale] ?? item.label.ko) : undefined;
}

/** 선택된 시술의 예상가 합 (KRW) — null이면 산정 불가 */
export function estimatePrice(serviceIds: string[]): number | null {
  const prices = serviceIds
    .map((id) => SERVICE_MAP.get(id))
    .map((s) => (s as { priceFrom?: number } | undefined)?.priceFrom)
    .filter((p): p is number => typeof p === "number");
  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0);
}

/**
 * KRW 금액을 "약 13만원" 같은 **한국어 요약용** 표기로 (만원 단위 반올림).
 * 디자이너 요약(DesignerSummary.estimatedPrice 등 ko 고정 컨텍스트)에서만 쓴다.
 * 손님에게 보이는 가격은 formatPrice(won, locale) 를 쓸 것.
 */
export function formatKRW(amount: number): string {
  const man = Math.round(amount / 10000);
  if (man >= 1) return `${man}만원`;
  return `${Math.round(amount / 1000) * 1000}원`;
}

/**
 * 손님 로케일에 맞춘 가격 표기 (KRW 통화, 로케일별 숫자/통화 포맷).
 * 예) ko "₩130,000" · ja "￥130,000" · en "₩130,000"
 * (통화는 항상 KRW — 한국 살롱 결제 통화. 손님 화면에 "13만원"이 새지 않게 함, P1-18)
 */
export function formatPrice(won: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(won);
}

/**
 * "다음 방문 권장" 표기를 손님 로케일로.
 * 리포트의 nextVisitWeeks 를 사람말 문구로 변환한다.
 */
export function formatNextVisit(weeks: number, locale: Locale): string {
  const w = Math.max(1, Math.round(weeks));
  switch (locale) {
    case "ja":
      return `次回の目安: 約${w}週間後`;
    case "en":
      return `Next visit: in about ${w} week${w === 1 ? "" : "s"}`;
    case "ko":
    default:
      return `다음 방문 권장: 약 ${w}주 후`;
  }
}

/**
 * ISO 날짜/시각 문자열을 손님 로케일로 표기 (날짜만, 시각 생략).
 * 잘못된 입력이면 원본을 그대로 돌려준다.
 */
export function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export {
  ALL_SERVICES,
  CONCERNS,
  CROWN_VOLUME,
  FACE_SHAPES,
  HAIR_DENSITY,
  HAIR_HISTORY,
  HAIR_TYPE,
  PRODUCTS,
  QUICK_REPLIES,
  SERVICE_CATEGORIES,
  TIME_PRESETS,
};
