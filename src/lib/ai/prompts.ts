/**
 * Gemini 프롬프트 빌더 + 구조화 출력 스키마.
 *
 * 서버 전용 모듈에서만 import (gemini.ts). 순수 함수/상수만 export 하므로
 * 그 자체로는 부수효과 없음 — 단, AiProvider 구현(gemini.ts)을 통해서만 쓰인다.
 *
 * 설계 원칙:
 * - 한국어 = 피벗 언어. 요약은 항상 한국어(디자이너용), 리포트는 손님 로케일.
 * - 카탈로그 라벨은 이미 호출자가 한국어로 해석해 넘긴다(SummarizeInput) → LLM 은
 *   "정리/문장화"만 하고 ID→라벨 매핑 같은 도메인 지식은 요구하지 않는다.
 * - 모든 자유 텍스트는 살롱(미용실) 도메인 맥락임을 명시해 용어 오역을 줄인다.
 * - 구조화가 필요한 summarize/report 는 responseSchema 로 JSON 강제, translate 는 평문.
 */

import type { Locale } from "@/lib/domain/types";
import type {
  ReportInput,
  SummarizeInput,
  TranslateInput,
} from "./types";

/* ── 로케일 → 사람 언어 라벨 (프롬프트 지시문용) ───────────── */
const LOCALE_LANGUAGE: Record<Locale, string> = {
  ko: "Korean (한국어)",
  ja: "Japanese (日本語)",
  en: "English",
  zh: "Chinese (中文, Simplified)",
};

/** Gemini responseSchema 에 쓰는 최소 타입 (SDK 없이 REST 직접 호출). */
export type GeminiSchema = {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN";
  description?: string;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  enum?: string[];
  nullable?: boolean;
};

/* ── F4: 인테이크 → 디자이너용 한국어 요약 ─────────────────── */

/**
 * 요약 프롬프트. 출력은 한국어, 미용실 현장 디자이너가 5초 안에 파악하도록.
 * 카탈로그 라벨은 한국어로 이미 해석되어 들어오므로 LLM 은 문장 정리에 집중한다.
 */
export function buildSummarizePrompt(input: SummarizeInput): string {
  const visit = input.isReturning ? "재방문" : "신규";
  const customerLang = LOCALE_LANGUAGE[input.customerLocale];
  const lines: string[] = [
    `국적/언어: ${input.customerLocale}`,
    `구분: ${visit}`,
    `희망 시술: ${fmtList(input.serviceLabelsKo)}`,
    `얼굴형: ${orNone(input.faceShapeKo)}`,
    `정수리 볼륨: ${orNone(input.crownVolumeKo)}`,
    `모발 밀도: ${orNone(input.hairDensityKo)}`,
    `모발 타입: ${orNone(input.hairTypeKo)}`,
    `가마/뻗침: ${orNone(input.cowlickKo)}`,
    `최근 시술 이력(타입·시기): ${fmtList(input.treatmentHistoryLabelsKo)}`,
    `고민(선택): ${fmtList(input.concernLabelsKo)}`,
    `알레르기: ${input.intake.allergy ? "있음" : "없음"}`,
    // 자유 텍스트는 손님 언어 원문 — 한국어로 번역해 반영하라고 아래 규칙에서 지시.
    `[손님 작성 원문 · ${customerLang}] 원하는 스타일 메모: ${orNoneRaw(input.styleNote)}`,
    `[손님 작성 원문 · ${customerLang}] 평소 고민 메모: ${orNoneRaw(input.concernNote)}`,
    `[손님 작성 원문 · ${customerLang}] 알레르기 메모: ${orNoneRaw(input.allergyNote)}`,
    `스타일 참고 사진: ${input.intake.stylePhotoUrls.length}장`,
    `예상 가격: ${orNone(input.estimatedPriceKo)}`,
  ];

  return [
    "당신은 한국 미용실(살롱)의 베테랑 리셉션 실장입니다.",
    "외국인 워크인 손님이 태블릿으로 작성한 접수표를, 시술 담당 디자이너가 한눈에 파악할 수 있도록 정리하세요.",
    "",
    "[작성 규칙]",
    "- 반드시 한국어로 작성합니다(디자이너용).",
    `- 손님이 자국어(${customerLang})로 적은 자유 텍스트(스타일/고민/알레르기 메모)는 자연스러운 한국어로 번역해 요약에 반영합니다.`,
    "- 미용 전문 용어(컷/펌/염색/탈색/클리닉 등)를 자연스럽게 사용합니다.",
    "- 추측하거나 없는 정보를 지어내지 마세요. 입력에 없는 값은 비웁니다.",
    "- 알레르기·탈색 이력·최근 시술 시기 등 시술 안전에 직결되는 주의사항은 반드시 hairCautions 에 포함합니다. 없으면 \"특이사항 없음\".",
    "- 가마/뻗침 정보가 있으면 styleDetail 에 반영합니다(컷/스타일링 시 참고).",
    "- headline 은 60자 이내 한 줄: 국적/구분 → 희망 시술 → 핵심 주의/고민 → 예상가 순으로 압축합니다.",
    "- raw 는 디자이너가 빠르게 훑을 수 있는 줄바꿈 불릿(\\n 구분) 한국어 요약 본문입니다.",
    "- styleDetail 에 손님의 스타일 메모(번역)를 녹여 씁니다. concerns 에 고민 칩 + 고민 메모(번역)를 합칩니다.",
    "- services 는 한국어 시술명 배열 그대로(예: [\"컷\", \"애쉬브라운 염색\"]).",
    "- nationality 는 국적 라벨(예: \"일본\", \"영어권\", \"한국\") 한 단어.",
    "",
    "[접수 정보]",
    lines.join("\n"),
  ].join("\n");
}

/** summarizeIntake 구조화 출력 스키마 (DesignerSummary 대응). */
export const SUMMARY_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    headline: {
      type: "STRING",
      description: "60자 이내 한국어 한 줄 요약 (국적·구분·시술·주의·예상가)",
    },
    nationality: {
      type: "STRING",
      description: "국적 라벨 한 단어 (예: 일본, 영어권, 한국)",
    },
    isReturning: { type: "BOOLEAN", description: "재방문 여부" },
    services: {
      type: "ARRAY",
      description: "한국어 시술명 배열",
      items: { type: "STRING" },
    },
    styleDetail: {
      type: "STRING",
      description: "얼굴형·모발 타입·볼륨·참고 사진 등 스타일 디테일 한국어 한 줄",
    },
    hairCautions: {
      type: "STRING",
      description: "시술 주의사항(알레르기·탈색 이력 등). 없으면 '특이사항 없음'",
    },
    concerns: { type: "STRING", description: "손님 고민 요약 한국어" },
    estimatedPrice: {
      type: "STRING",
      description: "예상 가격 한국어 표기 (없으면 빈 문자열)",
      nullable: true,
    },
    raw: {
      type: "STRING",
      description: "줄바꿈(\\n) 불릿 형식의 한국어 요약 본문",
    },
  },
  required: [
    "headline",
    "nationality",
    "isReturning",
    "services",
    "styleDetail",
    "hairCautions",
    "concerns",
    "raw",
  ],
};

/* ── F5: 상담 스레드 동적 번역 (계층③) ─────────────────────── */

/**
 * 번역 프롬프트. 미용실 상담 맥락을 힌트로 줘서 용어/톤을 맞춘다.
 * 출력은 번역문 평문만 (설명·따옴표·코드펜스 금지).
 */
export function buildTranslatePrompt(input: TranslateInput): string {
  const fromLang = LOCALE_LANGUAGE[input.from];
  const toLang = LOCALE_LANGUAGE[input.to];
  const domainHint =
    input.domain === "salon"
      ? "This is a live chat inside a Korean hair salon, between a customer and a hair designer. Use natural salon/beauty terminology (cut, perm, color, bleach, layers, bangs, etc.) and a polite, warm conversational tone."
      : "Keep a natural, polite conversational tone.";

  return [
    `You are a professional ${fromLang}↔${toLang} interpreter.`,
    domainHint,
    "",
    "[Rules]",
    `- Translate the message from ${fromLang} to ${toLang}.`,
    "- Output ONLY the translated text. No quotes, no labels, no explanations, no code fences.",
    "- Preserve numbers, prices, and proper nouns. Do not add or omit meaning.",
    "- If the text is already in the target language, return it unchanged.",
    "",
    "[Message]",
    input.text,
  ].join("\n");
}

/* ── F11: 시술 완료 → 손님 언어 헤어 리포트 초안 ───────────── */

/**
 * 리포트 프롬프트. 출력은 손님 로케일, 따뜻한 케어 톤.
 * 시술/제품 데이터는 디자이너 기록(한국어 피벗)에서 오고, LLM 은 손님 언어로
 * 친절하게 풀어쓴다(홈케어 안내 중심).
 */
export function buildReportPrompt(input: ReportInput): string {
  const lang = LOCALE_LANGUAGE[input.customerLocale];
  const s = input.summary;
  const grade = input.record?.stateGrade ?? "mid";
  const products = input.record?.products ?? [];

  const lines: string[] = [
    `Customer language: ${lang}`,
    `Services (Korean pivot): ${fmtListEn(s.services)}`,
    `Style detail (Korean): ${s.styleDetail || "(none)"}`,
    `Hair cautions (Korean): ${s.hairCautions || "(none)"}`,
    `Hair state grade: ${grade} (high=excellent / mid=normal / low=needs care)`,
    `Products used (Korean): ${fmtListEn(products)}`,
    `Agreed highlights from consultation (Korean): ${fmtListEn(
      input.threadHighlightsKo,
    )}`,
  ];

  return [
    "You are a caring senior hair designer at a Korean salon writing an after-service hair report ('헤어 인바디') for a foreign walk-in customer.",
    `Write the report in ${lang}, in a warm, encouraging, professional care tone — like a trusted stylist giving aftercare advice.`,
    "",
    "[Rules]",
    `- Write ALL text fields in ${lang}.`,
    "- serviceSummary: ONE warm, concise sentence (max ~20 words) summarizing today's service — scannable, not a paragraph.",
    "- products: array of product names the customer can recognize (translate/localize the Korean product names naturally; if none given, suggest 1-2 suitable aftercare products).",
    "- hairStateGrade: must be exactly one of 'high' | 'mid' | 'low', matching the given grade.",
    "- hairStateScore: integer 0-100 consistent with the grade (high ~80-95, mid ~60-75, low ~40-55).",
    "- homeCare: 2-4 short, actionable aftercare tips tailored to the services (e.g. color-care shampoo, no-wash window for color, treatment frequency). Each item a single clear sentence.",
    "- nextVisitWeeks: integer weeks until recommended next visit (color ~6, perm ~10, cut ~5; adjust by service).",
    "- Be specific and reassuring. Do not invent unsafe claims or medical advice.",
    "",
    "[Service record]",
    lines.join("\n"),
  ].join("\n");
}

/** draftReport 구조화 출력 스키마 (HairReportDraft 대응). */
export const REPORT_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    serviceSummary: {
      type: "STRING",
      description: "손님 언어로 된 오늘 시술 요약 한 문장",
    },
    products: {
      type: "ARRAY",
      description: "손님 언어로 된 사용/추천 제품명 배열",
      items: { type: "STRING" },
    },
    hairStateGrade: {
      type: "STRING",
      description: "모발 상태 등급",
      enum: ["high", "mid", "low"],
    },
    hairStateScore: {
      type: "INTEGER",
      description: "모발 상태 점수 0-100 (등급과 일관)",
    },
    homeCare: {
      type: "ARRAY",
      description: "손님 언어로 된 홈케어 안내 2-4개",
      items: { type: "STRING" },
    },
    nextVisitWeeks: {
      type: "INTEGER",
      description: "권장 재방문 주기(주)",
    },
  },
  required: [
    "serviceSummary",
    "products",
    "hairStateGrade",
    "hairStateScore",
    "homeCare",
    "nextVisitWeeks",
  ],
};

/* ── 작은 헬퍼 ─────────────────────────────────────────────── */
function fmtList(items: string[]): string {
  return items.length ? items.join(", ") : "없음";
}
function fmtListEn(items: string[]): string {
  return items.length ? items.join(", ") : "(none)";
}
function orNone(v?: string): string {
  return v && v.trim() ? v : "없음";
}
function orNoneRaw(v?: string): string {
  return v && v.trim() ? v.trim() : "(없음)";
}
