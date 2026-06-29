/**
 * 소통 도메인 타입 — 모든 에이전트(Backend/AI/FE)가 공유하는 단일 계약.
 * 이 파일의 시그니처를 바꾸려면 먼저 docs/AGENTS_CONTRACT.md 를 갱신할 것.
 */

/* ── 로케일 (한국어 피벗) ───────────────────────────────── */
export const LOCALES = ["ko", "ja", "en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

/** 손님에게 노출하는 언어 (한국어는 내국인/디자이너용) */
export const CUSTOMER_LOCALES = ["ja", "en", "zh", "ko"] as const;
export const DESIGNER_LOCALE: Locale = "ko";

/**
 * 다국어 텍스트 — ko/ja/en 은 필수(피벗·기존 손님 언어), zh 는 optional.
 * zh 는 4번째 손님 언어로 추가 중이며 라벨이 아직 안 채워진 곳이 있을 수 있어
 * optional 로 둔다(없으면 tx() 가 ko 로 폴백). 직접 `.ja`/`.en` 접근은 안 깨진다.
 */
export type LocalizedText = {
  ko: string;
  ja: string;
  en: string;
  zh?: string;
};

export function tx(text: LocalizedText, locale: Locale): string {
  // zh 가 비어있을 수 있어 nullish 폴백 → ko 피벗.
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
  /** 손님 연령 (선택) — 요약/추천에 참고. consultation.intake jsonb 저장이라 DB 변경 불필요. */
  age?: number;
  /** 손님 성별 (선택) — 시술명/추천 보정에 참고. */
  gender?: "female" | "male" | "other";
  /**
   * 손님이 고른 **큰 시술 분류**(컷·펌·염색·클리닉/케어·스타일링·기타).
   * MVP: 손님은 분류만 고르고, 실제 세부 시술(serviceIds)은 디자이너가 기록폼에서 정한다.
   */
  serviceCategoryIds: string[];
  /**
   * 실제 시술 id(살롱 메뉴). MVP에서 손님 인테이크는 더 이상 채우지 않고
   * 디자이너가 기록 시 확정한다. 레거시 인테이크 호환 위해 남겨둠.
   */
  serviceIds: string[];
  stylePhotoUrls: string[];
  /** 손님 셀피 사진 (선택) — 얼굴형/현재 스타일 참고용. */
  selfiePhotoUrl?: string;
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
  /**
   * (선택) AI 모델 학습 활용 동의 시각 (ISO). 별도 옵트인 — 필수 아님.
   * 이 값이 있을 때만 완료 시 **비식별 학습 샘플**(training_samples)을 적재한다.
   * 사진·전화·이름·자유텍스트·얼굴은 학습셋에서 제외(가명·통계 목적).
   */
  trainingConsentedAt?: string;
}

/**
 * 비식별 ML 학습 샘플 — 원본 PII(전화·사진·이름·자유텍스트)는 제외하고
 * 가명 customer 해시 + coarse 인구통계 + 모발 특징 + 시술/결과만 담는다.
 * 원본 상담은 90일 후 파기되지만(retention) 이 샘플은 자산으로 영구 축적된다.
 * 학습 옵트인 동의(trainingConsentedAt) 가 있는 완료 건에서만 생성한다.
 */
export interface TrainingSample {
  id: string;
  salonSlug: string;
  /** 가명 — customerId 의 비가역 해시(없으면 익명 1회성). 재방문 연결만, 재식별 불가. */
  customerPseudonym: string;
  visitedAt: string;
  /** 국적 프록시(손님 언어 로케일). */
  nationality?: string;
  gender?: "female" | "male" | "other";
  /** 연령대(정확 나이 아님 — 재식별 위험 완화). */
  ageBand?: string;
  faceShape?: FaceShape;
  crownVolume?: ThreeLevel;
  hairDensity?: ThreeLevel;
  hairType?: HairType;
  concernIds: string[];
  allergy: boolean;
  serviceIds: string[];
  products: string[];
  stateGrade?: ThreeLevel;
  hairStateScore?: number;
  satisfactionScore?: number;
  nextVisitWeeks?: number;
  createdAt: string;
  /** 신체정보(얼굴형·볼륨 등) 출처: designer=디자이너 판단 / customer=레거시 손님값. */
  inputBy?: "customer" | "designer";
  /** 시술 출처: designer=실제 한 것 / customer=손님 희망 분류 폴백(실제 아님). 섞지 말 것. */
  servicesInputBy?: "customer" | "designer";
  /** 데이터를 받은 디자이너(귀속). */
  designerId?: string;
  /** 사진 유무(H4 촬영습관 측정) — 비포/애프터 각각 들어왔는지. */
  hasBeforePhoto?: boolean;
  hasAfterPhoto?: boolean;
}

/** 정확 나이 → 연령대 밴드(학습셋 비식별용). */
export function ageBand(age: number | undefined): string | undefined {
  if (age == null || !Number.isFinite(age)) return undefined;
  if (age < 20) return "10s";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60s+";
}

export function emptyIntake(): IntakeDraft {
  return {
    phone: "",
    serviceCategoryIds: [],
    serviceIds: [],
    stylePhotoUrls: [],
    treatmentHistory: [],
    concernIds: [],
    allergy: false,
  };
}

/**
 * 디자이너 전문 판단으로 입력하는 신체정보 — 손님 인테이크에서 이동(MVP).
 * 디자이너가 보면 아는 항목(얼굴형·볼륨·머리숱·모질·가마·성별) + 알레르기 재확인.
 * D2 요약의 '디자이너 입력' 카드에서 채워 consultations.designer_input(jsonb)에 저장.
 */
export interface DesignerHairInput {
  faceShape?: FaceShape;
  crownVolume?: ThreeLevel;
  hairDensity?: ThreeLevel;
  hairType?: HairType;
  cowlickWhorl?: YesNoUnknown;
  cowlickSticking?: YesNoUnknown;
  gender?: "female" | "male" | "other";
  /** 손님 자기보고 알레르기를 디자이너가 재확인했는지(안전). */
  allergyConfirmedByDesigner?: boolean;
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
  /**
   * 손님이 요청한 스타일(요약 styleDetail 또는 인테이크 styleNote 에서 채움).
   * 신규 optional — 구 리포트 안전. completeConsultation 이 발송 시 채운다.
   */
  styleRequest?: string;
  /** 손님 고민(요약 concerns 또는 인테이크 concernNote 에서 채움). 신규 optional. */
  concerns?: string;
  /** 시술 주의사항(요약 hairCautions 에서 채움). 신규 optional. */
  cautions?: string;
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
  /** 기기 토큰으로 식별된 손님(살롱별 유일). 미식별(쿠키 없음) 진입은 undefined. */
  customerId?: string;
  customerLocale: Locale;
  status: ConsultationStatus;
  phone?: string;
  isReturning: boolean;
  intake: IntakeDraft;
  summary?: DesignerSummary;
  /** 디자이너가 요약 화면에서 입력한 신체정보(이동 항목) — 완료 시 카르테·학습에 반영. */
  designerInput?: DesignerHairInput;
  /** 시술 전 사진 — 요약 단계에서 촬영, 리포트의 before 로 사용. */
  beforePhotoUrl?: string;
  /** 토큰들 — 손님/디자이너/리포트 각각의 무인증 접근 키 */
  consultationToken: string;
  designerToken: string;
  reportToken?: string;
  /** 디자이너용 한국어(ko) 리포트 토큰 — 손님용 reportToken 과 별개의 무인증 접근 키. */
  designerReportToken?: string;
  createdAt: string;
}

/* ── 손님(customer) — 기기 토큰으로 식별, 살롱별 유일 ──────── */
/**
 * 손님 — 데이터 엔진의 신원 앵커. (salonSlug, deviceToken) 으로 살롱별 유일.
 * deviceToken = httpOnly secure 쿠키(sotong_did). 미인증 전화번호는 신원 앵커가 아니다
 * (phone 은 라벨 only — 절대 이력 조회/바인딩에 쓰지 않는다).
 */
export interface Customer {
  id: string;
  salonSlug: string;
  /** 기기 토큰(쿠키 값). 신원 앵커. */
  deviceToken?: string;
  /** 선택 — 라벨 only(이력 조회에 쓰지 않음) */
  phone?: string;
  contactOptOut: boolean;
  locale: Locale;
  /** 같은 (salonSlug, deviceToken) 으로 기존 손님이 조회되면 true */
  isReturning: boolean;
  createdAt: string;
}

/**
 * 손님 모발 프로필 — IntakeDraft 의 프로필 부분 집합을 customer 밑에 영속.
 * 재방문 프리필("지난번처럼")의 소스. customerId 로 1:N(최신 1건 사용).
 */
export interface CustomerHairProfile {
  customerId: string;
  faceShape?: FaceShape;
  crownVolume?: ThreeLevel;
  hairDensity?: ThreeLevel;
  hairType?: HairType;
  cowlickWhorl?: YesNoUnknown;
  cowlickSticking?: YesNoUnknown;
  treatmentHistory: TreatmentHistoryItem[];
  concernIds: string[];
  styleNote?: string;
  concernNote?: string;
  allergy: boolean;
  allergyNote?: string;
  createdAt: string;
}

/**
 * 시술 기록(카르테) — 방문 1건 = treatment_record 1행. customer 밑에 누적.
 * completeConsultation 에서 영속. 사장 콘솔 회원별 타임라인의 데이터 소스.
 */
export interface TreatmentRecord {
  id: string;
  consultationId: string;
  /** 기기 토큰으로 식별된 손님. 미식별 진입은 undefined. */
  customerId?: string;
  salonSlug: string;
  designerId?: string;
  designerName?: string;
  serviceIds: string[];
  products: string[];
  stateGrade?: ThreeLevel;
  /** 실제 캡처한 만족도/결과 점수(AI 추론값 아님) */
  satisfactionScore?: number;
  note?: string;
  visitedAt: string;
  /** 살롱 uuid(명시 FK). 기존 salonSlug 와 병행. */
  salonId?: string;
  /** 디자이너가 기록한 신체정보(이동된 항목) — 학습 feature. */
  faceShape?: FaceShape;
  crownVolume?: ThreeLevel;
  hairDensity?: ThreeLevel;
  hairType?: HairType;
  gender?: "female" | "male" | "other";
  /** 신체정보 출처: designer / customer(레거시). */
  inputBy?: "customer" | "designer";
  /** 시술 출처: designer=실제 / customer=희망 분류 폴백. */
  servicesInputBy?: "customer" | "designer";
  /** 손님 자기보고 알레르기를 디자이너가 재확인(안전). */
  allergyConfirmedByDesigner?: boolean;
  /** 사진 유무(H4 촬영습관 측정) — 비포/애프터 각각 들어왔는지. */
  hasBeforePhoto?: boolean;
  hasAfterPhoto?: boolean;
}

/** 국적 라벨 (요약·리포트 표기에 사용) */
export const NATIONALITY_BY_LOCALE: Record<Locale, string> = {
  ja: "일본",
  en: "영어권",
  ko: "한국",
  zh: "중국",
};
