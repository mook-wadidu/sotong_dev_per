/**
 * 소통 도메인 타입 — 모든 에이전트(Backend/AI/FE)가 공유하는 단일 계약.
 * 이 파일의 시그니처를 바꾸려면 먼저 docs/AGENTS_CONTRACT.md 를 갱신할 것.
 */

/* ── 로케일 (한국어 피벗) ───────────────────────────────── */
export const LOCALES = ["ko", "ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** 손님에게 노출하는 언어 (한국어는 내국인/디자이너용) */
export const CUSTOMER_LOCALES = ["ja", "en", "ko"] as const;
export const DESIGNER_LOCALE: Locale = "ko";

export type LocalizedText = Record<Locale, string>;

export function tx(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.ko;
}

/* ── ENUM 류 ───────────────────────────────────────────── */
export type ConsultationStatus =
  | "intake"
  | "consulting"
  | "in_service"
  | "completed"
  | "cancelled";

export type FaceShape =
  | "oval"
  | "round"
  | "square"
  | "long"
  | "heart"
  | "diamond";

export type ThreeLevel = "high" | "mid" | "low";
export type HairType = "straight" | "wavy" | "curly";

/** 가마/뻗침 등 3값 응답 (모름 허용) */
export type YesNoUnknown = "yes" | "no" | "unknown";

/* ── 최근 시술 이력 (타입 + 시기) ─────────────────────────── */
export type TreatmentType = "cut" | "perm" | "color" | "care";
export type TreatmentRecency = "2w" | "1m" | "3m" | "older";

export interface TreatmentHistoryItem {
  type: TreatmentType;
  recency: TreatmentRecency;
}

export type QuickReplyIntent =
  | "available"
  | "alternative"
  | "request_photo"
  | "be_right_there"
  | "price"
  | "time"
  | "decline" // 어렵습니다/불가
  | "conditional" // 조건부 가능
  | "checking" // 확인 중
  | "seat_guide" // 자리 안내
  | "step_update" // 시술 단계 안내
  | "recommend" // 추천
  | "greeting" // 인사
  | "closing" // 마무리 인사
  | "custom";

/* ── 인테이크 드래프트 (손님이 탭으로 채움) ─────────────── */
export interface IntakeDraft {
  /** 선택 — 한국 전화 없는 관광객은 비울 수 있다 */
  phone?: string;
  /** 연락 불필요(번호 없음)를 손님이 명시 */
  contactOptOut?: boolean;
  serviceIds: string[];
  stylePhotoUrls: string[];
  /** 손님 언어 자유 텍스트 — 원하는 스타일 메모 (요약에 번역·반영) */
  styleNote?: string;
  faceShape?: FaceShape;
  crownVolume?: ThreeLevel;
  hairDensity?: ThreeLevel;
  hairType?: HairType;
  /** 가마 유무 */
  cowlickWhorl?: YesNoUnknown;
  /** (가마 등으로) 머리 뻗침 여부 */
  cowlickSticking?: YesNoUnknown;
  /** 최근 시술 이력 — 시술 타입 + 시기(다중) */
  treatmentHistory: TreatmentHistoryItem[];
  concernIds: string[];
  /** 손님 언어 자유 텍스트 — 평소 고민 메모 (요약에 번역·반영) */
  concernNote?: string;
  allergy: boolean;
  allergyNote?: string;
  /** 개인정보·사진 수집 동의 시각 (ISO). 없으면 제출 차단 */
  consentedAt?: string;
}

export function emptyIntake(): IntakeDraft {
  return {
    phone: "",
    serviceIds: [],
    stylePhotoUrls: [],
    treatmentHistory: [],
    concernIds: [],
    allergy: false,
  };
}

/* ── AI 산출물: 디자이너용 한국어 요약 (F4 / §10.1) ─────── */
export interface DesignerSummary {
  /** 한 줄 헤드라인 (예: "일본인 신규 · 컷+애쉬브라운 · ...") */
  headline: string;
  nationality: string; // "일본" 등 (로케일 → 국적 라벨)
  isReturning: boolean;
  services: string[]; // 한국어 시술명
  styleDetail: string;
  hairCautions: string;
  
  concerns: string;
  estimatedPrice?: string;
  /** 전체 한국어 요약 본문 (말풍선/카드 본문용) */
  raw: string;
}

/* ── 메시지 / 번역 (계층③ 동적 텍스트) ─────────────────── */
export type MessageSender = "customer" | "designer" | "system";

export interface Message {
  id: string;
  consultationId: string;
  sender: MessageSender;
  sourceText: string; // 원문 (항상 보존)
  sourceLocale: Locale;
  intent?: QuickReplyIntent; // 퀵리플라이 칩에서 온 경우
  /** locale → 번역문. 원문 로케일은 sourceText 와 동일 */
  translations: Partial<Record<Locale, string>>;
  createdAt: string; // ISO
}

/* ── 헤어 인바디 리포트 (F11 / §10.2) ───────────────────── */
export interface HairReportDraft {
  serviceSummary: string;
  products: string[];
  hairStateGrade: ThreeLevel; // 상/중/하
  hairStateScore: number; // 0-100
  homeCare: string[];
  nextVisitWeeks: number;
}

export interface HairReport extends HairReportDraft {
  consultationId: string;
  reportToken: string;
  salonName: string;
  designerName: string;
  date: string; // ISO date
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  /** 리포트를 렌더하는 손님 언어 */
  locale: Locale;
}

/* ── 상담(consultation) 집계 루트 ──────────────────────── */
export interface Consultation {
  id: string;
  salonSlug: string;
  /** 배정된 디자이너 (살롱 공용 QR 진입은 미배정 = undefined) */
  designerId?: string;
  designerName?: string;
  customerLocale: Locale;
  status: ConsultationStatus;
  phone?: string;
  isReturning: boolean;
  intake: IntakeDraft;
  summary?: DesignerSummary;
  /** 토큰들 — 손님/디자이너/리포트 각각의 무인증 접근 키 */
  consultationToken: string;
  designerToken: string;
  reportToken?: string;
  createdAt: string;
}

/** 국적 라벨 (요약·리포트 표기에 사용) */
export const NATIONALITY_BY_LOCALE: Record<Locale, string> = {
  ja: "일본",
  en: "영어권",
  ko: "한국",
};
