import type {
  Consultation,
  ConsultationStatus,
  Customer,
  CustomerHairProfile,
  DesignerSummary,
  HairReport,
  IntakeDraft,
  Locale,
  LocalizedText,
  Message,
  ThreeLevel,
  TreatmentRecord,
} from "@/lib/domain/types";

/** 디자이너 직급(rank) — 살롱이 정의, 직급별 가격 보정에 사용 */
export interface DesignerRank {
  id: string;
  label: string;
}

/**
 * 신규 살롱 기본 직급 — 한국 살롱 표준(원장/실장/디자이너).
 * createSalon 이 designerRanks 를 안 받으면 이 값으로 채운다(빈 직급이면
 * 콘솔 "디자이너 추가" 의 직급 선택이 비어버리는 버그 방지). 단일 진실원천.
 */
export const DEFAULT_DESIGNER_RANKS: DesignerRank[] = [
  { id: "director", label: "원장" },
  { id: "senior", label: "실장" },
  { id: "designer", label: "디자이너" },
];

/**
 * 살롱별 시술 카테고리 — 콘솔에서 편집 가능(전역 catalog/data.ts 대체).
 */
export interface SalonServiceCategory {
  id: string;
  salonSlug: string;
  label: LocalizedText;
  sort: number;
}

/**
 * 살롱별 시술 — 콘솔에서 편집 가능. 기본가 + 직급별 보정가(옵션).
 */
export interface SalonService {
  id: string;
  salonSlug: string;
  categoryId: string;
  label: LocalizedText;
  /** 기본 시작가(KRW) — 살롱 공용/직급 보정 없을 때 */
  basePriceFrom: number;
  /** rankId → 보정가(KRW). 디자이너 직급이 일치하면 우선 적용 */
  rankPrices?: Record<string, number>;
  active: boolean;
}

/**
 * 살롱(그룹/테넌트) — 그룹 메타만 보유한다.
 * 디자이너(다수)는 별도 Designer 로 분리(살롱 1 : 디자이너 N).
 * 디자이너명/staffToken/로고는 더 이상 Salon 에 두지 않는다.
 */
export interface Salon {
  slug: string;
  name: string;
  nameTranslations?: Partial<Record<Locale, string>>;
  /** 손님에게 노출하는 언어 */
  locales: Locale[];
  /**
   * 살롱 공용(지정없음) 입장 토큰(QR) 키 버전 — 유출 시 ++ 로 폐기/회전(P1).
   * makeSalonEntryToken(slug, entryKeyVersion) 으로 발급, verify 후 이 값과 대조.
   */
  entryKeyVersion: number;
  /** 지점 식별 메타 (QR 인쇄/배치용) */
  address?: string;
  tel?: string;
  businessHours?: string;
  placementLabel?: string;
  /** 디자이너 직급 정의 (콘솔에서 편집). 직급별 가격 보정의 키. */
  designerRanks: DesignerRank[];
  /** 살롱 오너 콘솔 접근 토큰 — 메뉴/디자이너/직급 편집 권한 */
  ownerToken: string;
}

/**
 * 클라이언트로 내보내도 안전한 살롱 투영(P0/P1).
 * ownerToken(어드민 동급 비밀)·designerRanks(내부 가격 키) 등은 절대 포함하지 않는다.
 * "use server" 액션이 클라에 전달하는 살롱 객체는 반드시 이 타입으로 투영한다.
 */
export interface PublicSalon {
  slug: string;
  name: string;
  nameTranslations?: Partial<Record<Locale, string>>;
  locales: Locale[];
  /** QR 키 회전 후에도 진입 토큰을 재발급하려면 클라가 알아야 하므로 안전하게 노출 가능. */
  entryKeyVersion: number;
  address?: string;
  tel?: string;
  businessHours?: string;
  placementLabel?: string;
}

/** Salon(전체) → PublicSalon 투영 — 비밀 필드(ownerToken 등) 제거. */
export function toPublicSalon(salon: Salon): PublicSalon {
  return {
    slug: salon.slug,
    name: salon.name,
    nameTranslations: salon.nameTranslations,
    locales: salon.locales,
    entryKeyVersion: salon.entryKeyVersion,
    address: salon.address,
    tel: salon.tel,
    businessHours: salon.businessHours,
    placementLabel: salon.placementLabel,
  };
}

/**
 * 디자이너 — 살롱 그룹 아래 개별 스태프.
 * QR/인박스는 디자이너 단위(또는 살롱 공용)로 동작한다.
 */
export interface Designer {
  id: string;
  salonSlug: string;
  name: string;
  /** 디자이너 개인 인박스 접근 토큰 */
  staffToken: string;
  /** 디자이너 개인 입장 토큰(QR) 키 버전 — 유출 시 ++ 로 폐기/회전 */
  entryKeyVersion: number;
  /** 디자이너 직급 (Salon.designerRanks 의 id). 직급별 가격 보정에 사용. */
  rankId?: string;
}

/**
 * 클라이언트로 내보내도 안전한 디자이너 투영(P0/P1).
 * staffToken(인박스 접근 비밀) 은 포함하지 않는다 — C1 진입 화면 등 손님 경로용.
 */
export interface PublicDesigner {
  id: string;
  name: string;
  rankId?: string;
}

/** Designer(전체) → PublicDesigner 투영 — staffToken 등 비밀 제거. */
export function toPublicDesigner(designer: Designer): PublicDesigner {
  return { id: designer.id, name: designer.name, rankId: designer.rankId };
}

/** 어드민용 디자이너 투영 — 서명된 입장 토큰/경로 + 담당 건수(서버 계산) */
export interface AdminDesigner extends Designer {
  entryToken: string;
  entryPath: string; // /{locale}/c/e/{entryToken}
  consultationCount: number;
}

/**
 * 어드민용 살롱 투영 — 살롱 공용 입장 토큰/경로 + 디자이너 목록(서버 계산).
 */
export interface AdminSalon extends Salon {
  /** 살롱 공용(지정없음) QR 입장 토큰/경로 */
  salonEntryToken: string;
  salonEntryPath: string; // /{locale}/c/e/{entryToken}
  designers: AdminDesigner[];
}

/** 어드민 문의 목록용 경량 투영 (사진 dataURL·원본 PII 제외) */
export interface ConsultationListItem {
  id: string;
  salonSlug: string;
  createdAt: string;
  status: ConsultationStatus;
  customerLocale: Locale;
  nationality: string;
  isReturning: boolean;
  headline: string; // summary.headline 또는 대체
  maskedPhone?: string; // 뒤 4자리만
  designerToken: string;
  hasReport: boolean;
  /** 배정된 디자이너 (살롱 공용 QR 진입은 미배정 = undefined) */
  designerId?: string;
  designerName?: string;
  /** 기기 토큰으로 식별된 손님(있으면 콘솔에서 회원 카르테로 진입) */
  customerId?: string;
}

export interface CreateConsultationInput {
  salonSlug: string;
  customerLocale: Locale;
  isReturning: boolean;
  phone?: string;
  intake: IntakeDraft;
  /** 디자이너 QR 진입이면 배정, 살롱 공용 QR 진입이면 미배정 */
  designerId?: string;
  designerName?: string;
  /** 기기 토큰으로 식별/생성된 손님 바인딩(있으면 Consultation.customerId 로 보존) */
  customerId?: string;
}

/** 손님 생성 입력 — id/createdAt/isReturning 은 repo 가 발급(신규=항상 false). */
export interface CreateCustomerInput {
  salonSlug: string;
  /** 기기 토큰(쿠키 값). 신원 앵커. (salonSlug, deviceToken) 으로 유일. */
  deviceToken: string;
  phone?: string;
  contactOptOut: boolean;
  locale: Locale;
}

/**
 * 손님 모발 프로필 입력 — customerId/createdAt 제외한 CustomerHairProfile 본문.
 * upsertCustomerHairProfile 가 customerId/salonSlug 를 별도 인자로 받는다.
 */
export type CustomerHairProfileInput = Omit<
  CustomerHairProfile,
  "customerId" | "createdAt"
>;

/** 시술 기록 생성 입력 — id/visitedAt 은 repo 가 발급(visitedAt=now). */
export interface CreateTreatmentRecordInput {
  consultationId: string;
  customerId?: string;
  salonSlug: string;
  designerId?: string;
  designerName?: string;
  serviceIds: string[];
  products: string[];
  stateGrade?: ThreeLevel;
  satisfactionScore?: number;
  note?: string;
}

export type NewMessage = Omit<Message, "id" | "createdAt"> & {
  createdAt?: string;
};

/** 살롱 생성 입력 (콘솔/시드) — 토큰류는 repo 가 발급 */
export interface CreateSalonInput {
  slug: string;
  name: string;
  nameTranslations?: Partial<Record<Locale, string>>;
  locales?: Locale[];
  address?: string;
  tel?: string;
  businessHours?: string;
  placementLabel?: string;
  designerRanks?: DesignerRank[];
}

/** 디자이너 생성 입력 — staffToken/entryKeyVersion 은 repo 가 발급 */
export interface CreateDesignerInput {
  salonSlug: string;
  name: string;
  rankId?: string;
  /** 시드/마이그레이션용 고정 id (생략 시 repo 가 발급) */
  id?: string;
  /** 시드용 고정 staffToken (생략 시 repo 가 강한 랜덤 발급) */
  staffToken?: string;
}

/**
 * 디자이너 웹푸시 구독 — PWA Push(VAPID). endpoint 가 고유 키(브라우저/디바이스당 1개).
 * staffToken 으로 구독 시점의 디자이너를 기록(만료 정리/디버깅용), 알림 발송은 designerId 로 조회.
 */
export interface PushSub {
  id: string;
  designerId: string;
  staffToken: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

/** 새 구독 입력 — id/createdAt 은 repo 가 발급. endpoint 중복 시 upsert. */
export type NewPushSub = Omit<PushSub, "id" | "createdAt">;

/** 어드민 에러/이슈 로그 (발생 에러 모니터링) */
export type ErrorSeverity = "info" | "warning" | "error";

export interface ErrorLog {
  id: string;
  salonSlug?: string;
  severity: ErrorSeverity;
  source: string; // 예: "intake", "translate", "client", "report"
  message: string;
  detail?: string;
  consultationId?: string;
  createdAt: string;
}

export type NewErrorLog = Omit<ErrorLog, "id" | "createdAt"> & {
  createdAt?: string;
};

export interface ListConsultationsOptions {
  salonSlug?: string;
  limit?: number;
  /** 특정 디자이너 담당 건만 */
  designerId?: string;
  /** 미배정(살롱 공용 진입) 건만 */
  unassignedOnly?: boolean;
}

/**
 * Repo — 영속성 계약. memory(기본) / supabase 두 드라이버가 동일하게 구현.
 * Backend 에이전트는 lib/db/supabase.ts 에서 이 인터페이스를 구현한다.
 */
export interface Repo {
  readonly driver: string;

  getSalon(slug: string): Promise<Salon | null>;
  listSalons(): Promise<Salon[]>;
  /** 오너 콘솔 토큰으로 살롱 조회 (콘솔 권한 확인) */
  getSalonByOwnerToken(token: string): Promise<Salon | null>;
  /** 살롱 생성 (콘솔/시드) — ownerToken/entryKeyVersion 발급 */
  createSalon(input: CreateSalonInput): Promise<Salon>;
  /** 살롱 공용 QR 키 버전 갱신(회전/폐기) — 유출 시 ++ 로 기존 QR 무효화(P1) */
  updateSalonEntryKeyVersion(slug: string, version: number): Promise<void>;
  /** 살롱 디자이너 직급 정의 교체(콘솔 직급 편집) — designer_ranks 통째 갱신 */
  updateSalonRanks(salonSlug: string, ranks: DesignerRank[]): Promise<void>;

  /** 디자이너 조회 (살롱 1 : 디자이너 N) */
  getDesignerByStaffToken(token: string): Promise<Designer | null>;
  getDesignerById(id: string): Promise<Designer | null>;
  listDesigners(salonSlug: string): Promise<Designer[]>;
  /** 디자이너 생성 (콘솔/시드) — staffToken/entryKeyVersion 발급 */
  createDesigner(input: CreateDesignerInput): Promise<Designer>;
  /** 디자이너 수정 (이름/직급 등) */
  updateDesigner(designer: Designer): Promise<void>;

  /** 살롱별 시술 카탈로그 (콘솔 편집 대상) */
  listServiceCategories(salonSlug: string): Promise<SalonServiceCategory[]>;
  listServices(salonSlug: string): Promise<SalonService[]>;
  upsertServiceCategory(category: SalonServiceCategory): Promise<void>;
  upsertService(service: SalonService): Promise<void>;
  deleteService(id: string): Promise<void>;

  createConsultation(input: CreateConsultationInput): Promise<Consultation>;
  /** 미배정 상담을 디자이너에게 배정(인박스 '내 손님으로 가져오기') */
  assignConsultation(
    consultationId: string,
    designer: { id: string; name: string },
  ): Promise<void>;
  /** 어드민 문의사항 목록 (지점 필터 가능) */
  listConsultations(opts?: ListConsultationsOptions): Promise<Consultation[]>;
  getByConsultationToken(token: string): Promise<Consultation | null>;
  getByDesignerToken(token: string): Promise<Consultation | null>;
  getByReportToken(token: string): Promise<Consultation | null>;

  updateStatus(id: string, status: ConsultationStatus): Promise<void>;
  setSummary(id: string, summary: DesignerSummary): Promise<void>;
  setReportToken(id: string, reportToken: string): Promise<void>;

  /* ── 데이터 엔진: 손님 식별 / 카르테 누적 ─────────────────── */
  /** 기기 토큰으로 살롱별 손님 조회. (salonSlug, deviceToken) 매칭. 없으면 null. */
  getCustomerByDeviceToken(
    salonSlug: string,
    deviceToken: string,
  ): Promise<Customer | null>;
  /** 신규 손님 생성(첫 인테이크 제출 시). isReturning 은 항상 false 로 발급. */
  createCustomer(input: CreateCustomerInput): Promise<Customer>;
  /** 손님 모발 프로필 영속(재방문 프리필 소스). 최신 1건이 유효. */
  upsertCustomerHairProfile(
    customerId: string,
    salonSlug: string,
    profile: CustomerHairProfileInput,
  ): Promise<void>;
  /** 손님의 최신 모발 프로필. 없으면 null. */
  getCustomerHairProfile(customerId: string): Promise<CustomerHairProfile | null>;
  /** 시술 기록(카르테) 1건 영속. visitedAt=now, id 는 repo 발급. */
  createTreatmentRecord(
    input: CreateTreatmentRecordInput,
  ): Promise<TreatmentRecord>;
  /** 손님의 시술 기록 목록 — visitedAt desc. */
  listCustomerTreatments(customerId: string): Promise<TreatmentRecord[]>;
  /**
   * 손님의 마지막 상담(단골 라우팅용 — 지난 담당 designerId 식별).
   * createdAt desc 의 최신 1건. 없으면 null.
   */
  getLastConsultationForCustomer(
    customerId: string,
  ): Promise<Consultation | null>;

  /**
   * PII 파기(PIPA 보관/파기) — 보관기간 경과 상담의 전화·사진·자유텍스트를
   * 영속적으로 제거한다. `redacted` 는 retention.redactConsultationPii 가
   * 만든 마스킹된 상담(비PII 필드는 그대로 유지). cleanupExpiredPII 가 호출.
   */
  scrubConsultationPii(redacted: Consultation): Promise<void>;

  addMessage(msg: NewMessage): Promise<Message>;
  listMessages(consultationId: string, sinceIso?: string): Promise<Message[]>;

  saveReport(report: HairReport): Promise<void>;
  getReport(reportToken: string): Promise<HairReport | null>;

  /** 디자이너 웹푸시 구독 (PWA Push/VAPID) */
  savePushSubscription(input: NewPushSub): Promise<void>;
  listPushSubscriptions(designerId: string): Promise<PushSub[]>;
  deletePushSubscription(endpoint: string): Promise<void>;

  /** 에러/이슈 로깅 (어드민 모니터링) */
  logError(entry: NewErrorLog): Promise<ErrorLog>;
  listErrors(opts?: ListConsultationsOptions): Promise<ErrorLog[]>;

  /**
   * 고정 윈도우 레이트리밋 증분(서버리스 멀티인스턴스 공유 카운터, P0).
   * (bucket, windowStart) 키로 count 를 +1 하고 증가 후의 count 를 돌려준다.
   * supabase 드라이버는 DB 백드(공유), memory 는 인프로세스 폴백.
   */
  rateLimitHit(bucket: string, windowStartMs: number): Promise<number>;
}
