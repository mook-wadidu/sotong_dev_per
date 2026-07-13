import type {
  DesignerSummary,
  HairReportDraft,
  IntakeDraft,
  Locale,
  ThreeLevel,
} from "@/lib/domain/types";

/* ── 요약 입력 (F4) ────────────────────────────────────── */
export interface SummarizeInput {
  customerLocale: Locale;
  isReturning: boolean;
  intake: IntakeDraft;
  /** 카탈로그에서 미리 한국어로 해석한 라벨들 (provider 무상태) */
  serviceLabelsKo: string[];
  concernLabelsKo: string[];
  /** 최근 시술 이력 — 한국어 "타입(시기)" 라벨 배열 (예: "염색(2주 내)") */
  treatmentHistoryLabelsKo: string[];
  faceShapeKo?: string;
  crownVolumeKo?: string;
  hairDensityKo?: string;
  hairTypeKo?: string;
  /** 가마/뻗침 — 한국어 한 줄 (예: "가마 있음 · 뻗침 있음"). 없으면 undefined */
  cowlickKo?: string;
  /** 손님 언어 자유 텍스트 — 원하는 스타일 메모 (원문) */
  styleNote?: string;
  /** 손님 언어 자유 텍스트 — 평소 고민 메모 (원문) */
  concernNote?: string;
  /** 손님 언어 자유 텍스트 — 알레르기 메모 (원문) */
  allergyNote?: string;
  estimatedPriceKo?: string;
}

/* ── 번역 입력 (F5, 계층③ 동적) ────────────────────────── */
export interface TranslateInput {
  text: string;
  from: Locale;
  to: Locale;
  /** "salon" = 미용 용어 맥락 힌트 */
  domain?: "salon";
}

/* ── 리포트 초안 입력 (F11) ────────────────────────────── */
export interface ReportInput {
  customerLocale: Locale;
  summary: DesignerSummary;
  /** 상담 스레드 최근 대화(한국어) — "합의"가 아니라 참고 맥락(거절/가정 포함 가능). */
  threadHighlightsKo: string[];
  /**
   * 디자이너가 **실제로 한** 시술의 ko 라벨 — 리포트 시술 서술의 권위 소스.
   * 없으면(디자이너 미기록) summary.services(손님 인테이크 희망)로 폴백.
   */
  actualServiceLabelsKo?: string[];
  record?: {
    products: string[];
    stateGrade?: ThreeLevel;
  };
}

/** AI 산출 계약 — mock / gemini 가 동일하게 구현 */
export interface AiProvider {
  readonly name: string;
  summarizeIntake(input: SummarizeInput): Promise<DesignerSummary>;
  translate(input: TranslateInput): Promise<string>;
  draftReport(input: ReportInput): Promise<HairReportDraft>;
}
