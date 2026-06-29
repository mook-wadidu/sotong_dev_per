import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Consultation,
  ConsultationStatus,
  Customer,
  CustomerHairProfile,
  DesignerHairInput,
  DesignerSummary,
  FaceShape,
  HairReport,
  HairType,
  IntakeDraft,
  Locale,
  LocalizedText,
  Message,
  MessageSender,
  QuickReplyIntent,
  ThreeLevel,
  TrainingSample,
  TreatmentHistoryItem,
  TreatmentRecord,
  YesNoUnknown,
} from "@/lib/domain/types";
import type {
  CreateConsultationInput,
  CreateCustomerInput,
  CreateDesignerInput,
  CreateSalonInput,
  CreateTreatmentRecordInput,
  CustomerHairProfileInput,
  Designer,
  DesignerRank,
  ErrorLog,
  ErrorSeverity,
  ListConsultationsOptions,
  NewErrorLog,
  NewMessage,
  NewPushSub,
  PushSub,
  Repo,
  Salon,
  SalonService,
  SalonServiceCategory,
} from "./types";
import { DEFAULT_DESIGNER_RANKS } from "./types";

/**
 * SupabaseRepo — Postgres 영속 드라이버 (실 구현).
 * 모든 접근은 서버(service role)에서 수행되고, snake_case(DB) ↔ camelCase(도메인) 매핑은 여기서 한다.
 * intake/summary/translations 는 jsonb 컬럼으로 도메인 객체를 통째로 보존한다.
 * 쿼리 에러는 throw (호출부 service 레이어가 logError 로 어드민 에러판에 노출).
 */

/** 무인증 접근 토큰 — 절단 없이 192bit 랜덤(base64url). memory 드라이버와 동일 정책(P0/36). */
const token = () => randomBytes(24).toString("base64url");

function fail(scope: string, error: { message: string } | null): never {
  throw new Error(`[supabase] ${scope}: ${error?.message ?? "unknown error"}`);
}

/* ── DB row 타입 (필요한 컬럼만) ─────────────────────────── */
interface SalonRow {
  slug: string;
  name: string;
  name_translations: Partial<Record<Locale, string>> | null;
  locales: Locale[];
  address: string | null;
  tel: string | null;
  business_hours: string | null;
  placement_label: string | null;
  entry_key_version: number;
  // jsonb 원본 — label 은 구버전 string 또는 신버전 LocalizedText. toSalon 이 normalizeRank 로 정규화.
  designer_ranks: { id: string; label: unknown }[] | null;
  owner_token: string;
}

interface StaffRow {
  id: string;
  salon_slug: string;
  name: string;
  staff_token: string;
  entry_key_version: number;
  rank_id: string | null;
}

interface SalonServiceCategoryRow {
  id: string;
  salon_slug: string;
  label_ko: string;
  label_translations: Partial<Record<Locale, string>> | null;
  sort_order: number;
}

interface SalonServiceRow {
  id: string;
  salon_slug: string;
  category_id: string;
  label_ko: string;
  label_translations: Partial<Record<Locale, string>> | null;
  base_price_from: number;
  rank_prices: Record<string, number> | null;
  active: boolean;
}

interface ConsultationRow {
  id: string;
  salon_slug: string;
  designer_id: string | null;
  designer_name: string | null;
  customer_id: string | null;
  customer_locale: Locale;
  status: ConsultationStatus;
  phone: string | null;
  is_returning: boolean;
  intake: IntakeDraft;
  summary: DesignerSummary | null;
  designer_input: DesignerHairInput | null;
  consultation_token: string;
  designer_token: string;
  report_token: string | null;
  designer_report_token: string | null;
  before_photo_url: string | null;
  created_at: string;
}

interface CustomerRow {
  id: string;
  salon_slug: string;
  device_token: string | null;
  phone: string | null;
  contact_opt_out: boolean;
  locale: Locale;
  is_returning: boolean;
  created_at: string;
}

interface CustomerHairProfileRow {
  customer_id: string;
  face_shape: FaceShape | null;
  crown_volume: ThreeLevel | null;
  hair_density: ThreeLevel | null;
  hair_type: HairType | null;
  cowlick_whorl: string | null;
  cowlick_sticking: string | null;
  treatment_history: TreatmentHistoryItem[] | null;
  concern_ids: string[] | null;
  style_note: string | null;
  concern_note: string | null;
  allergy: boolean;
  allergy_note: string | null;
  created_at: string;
}

interface TreatmentRecordRow {
  id: string;
  consultation_id: string;
  customer_id: string | null;
  salon_id: string | null;
  salon_slug: string | null;
  designer_id: string | null;
  designer_name: string | null;
  service_ids: string[] | null;
  products: string[] | null;
  state_grade: ThreeLevel | null;
  satisfaction_score: number | null;
  note: string | null;
  visited_at: string;
  face_shape: FaceShape | null;
  crown_volume: ThreeLevel | null;
  hair_density: ThreeLevel | null;
  hair_type: HairType | null;
  gender: "female" | "male" | "other" | null;
  input_by: "customer" | "designer" | null;
  services_input_by: "customer" | "designer" | null;
  allergy_confirmed_by_designer: boolean | null;
  has_before_photo: boolean | null;
  has_after_photo: boolean | null;
}

interface MessageRow {
  id: string;
  consultation_id: string;
  sender: MessageSender;
  source_text: string;
  source_locale: Locale;
  intent: QuickReplyIntent | null;
  translations: Partial<Record<Locale, string>> | null;
  created_at: string;
}

interface HairReportRow {
  consultation_id: string;
  report_token: string;
  salon_name: string;
  designer_name: string;
  locale: Locale;
  service_summary: string;
  products: string[] | null;
  hair_state_grade: HairReport["hairStateGrade"];
  hair_state_score: number;
  home_care: string[] | null;
  next_visit_weeks: number;
  report_date: string;
  before_photo_url: string | null;
  after_photo_url: string | null;
  style_request: string | null;
  concerns: string | null;
  cautions: string | null;
}

interface ErrorLogRow {
  id: string;
  salon_slug: string | null;
  severity: ErrorSeverity;
  source: string;
  message: string;
  detail: string | null;
  consultation_id: string | null;
  created_at: string;
}

interface PushSubRow {
  id: string;
  designer_id: string;
  staff_token: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

const SALON_COLS =
  "slug,name,name_translations,locales,address,tel,business_hours,placement_label,entry_key_version,designer_ranks,owner_token";
const STAFF_COLS = "id,salon_slug,name,staff_token,entry_key_version,rank_id";
const SALON_SERVICE_CATEGORY_COLS =
  "id,salon_slug,label_ko,label_translations,sort_order";
const SALON_SERVICE_COLS =
  "id,salon_slug,category_id,label_ko,label_translations,base_price_from,rank_prices,active";
const CONSULTATION_COLS =
  "id,salon_slug,designer_id,designer_name,customer_id,customer_locale,status,phone,is_returning,intake,summary,designer_input,consultation_token,designer_token,report_token,designer_report_token,before_photo_url,created_at";
const CUSTOMER_COLS =
  "id,salon_slug,device_token,phone,contact_opt_out,locale,is_returning,created_at";
const CUSTOMER_HAIR_PROFILE_COLS =
  "customer_id,face_shape,crown_volume,hair_density,hair_type,cowlick_whorl,cowlick_sticking,treatment_history,concern_ids,style_note,concern_note,allergy,allergy_note,created_at";
const TREATMENT_RECORD_COLS =
  "id,consultation_id,customer_id,salon_id,salon_slug,designer_id,designer_name,service_ids,products,state_grade,satisfaction_score,note,visited_at,face_shape,crown_volume,hair_density,hair_type,gender,input_by,services_input_by,allergy_confirmed_by_designer,has_before_photo,has_after_photo";
const MESSAGE_COLS =
  "id,consultation_id,sender,source_text,source_locale,intent,translations,created_at";
const REPORT_COLS =
  "consultation_id,report_token,salon_name,designer_name,locale,service_summary,products,hair_state_grade,hair_state_score,home_care,next_visit_weeks,report_date,before_photo_url,after_photo_url,style_request,concerns,cautions";
const ERROR_COLS =
  "id,salon_slug,severity,source,message,detail,consultation_id,created_at";
const PUSH_SUB_COLS =
  "id,designer_id,staff_token,endpoint,p256dh,auth,created_at";

/* ── row → 도메인 매핑 ───────────────────────────────────── */
/** label_ko + label_translations(jsonb) → LocalizedText (ko 항상 채움). */
function toLocalized(
  ko: string,
  translations: Partial<Record<Locale, string>> | null,
): LocalizedText {
  return {
    ko,
    ja: translations?.ja ?? ko,
    en: translations?.en ?? ko,
  };
}

function toSalon(r: SalonRow): Salon {
  return {
    slug: r.slug,
    name: r.name,
    nameTranslations: r.name_translations ?? undefined,
    locales: r.locales,
    address: r.address ?? undefined,
    tel: r.tel ?? undefined,
    businessHours: r.business_hours ?? undefined,
    placementLabel: r.placement_label ?? undefined,
    entryKeyVersion: r.entry_key_version ?? 1,
    // 하위호환: 기존 행 rank.label 은 한국어 단일 string 일 수 있다 → {ko: label} 로 정규화.
    // 이미 LocalizedText 객체면 그대로 둔다(백필은 메인이 — jsonb 라 스키마 마이그레이션 불필요).
    designerRanks: (r.designer_ranks ?? []).map(normalizeRank),
    ownerToken: r.owner_token,
  };
}

/**
 * designer_ranks(jsonb) 한 항목의 label 정규화 — 구버전 string 을 {ko:label} 로.
 * (DesignerRank.label 이 LocalizedText 로 바뀌기 전 저장된 행 호환.)
 */
function normalizeRank(r: { id: string; label: unknown }): DesignerRank {
  const label =
    typeof r.label === "string"
      ? { ko: r.label, ja: r.label, en: r.label }
      : (r.label as LocalizedText);
  return { id: r.id, label };
}

function toDesigner(r: StaffRow): Designer {
  return {
    id: r.id,
    salonSlug: r.salon_slug,
    name: r.name,
    staffToken: r.staff_token,
    entryKeyVersion: r.entry_key_version ?? 1,
    rankId: r.rank_id ?? undefined,
  };
}

function toServiceCategory(r: SalonServiceCategoryRow): SalonServiceCategory {
  return {
    id: r.id,
    salonSlug: r.salon_slug,
    label: toLocalized(r.label_ko, r.label_translations),
    sort: r.sort_order ?? 0,
  };
}

function toService(r: SalonServiceRow): SalonService {
  return {
    id: r.id,
    salonSlug: r.salon_slug,
    categoryId: r.category_id,
    label: toLocalized(r.label_ko, r.label_translations),
    basePriceFrom: r.base_price_from ?? 0,
    rankPrices: r.rank_prices ?? undefined,
    active: r.active ?? true,
  };
}

/** LocalizedText → {label_ko, label_translations} (ja/en 만 보존). */
function fromLocalized(label: LocalizedText): {
  label_ko: string;
  label_translations: Partial<Record<Locale, string>>;
} {
  return {
    label_ko: label.ko,
    label_translations: { ja: label.ja, en: label.en },
  };
}

function toConsultation(r: ConsultationRow): Consultation {
  return {
    id: r.id,
    salonSlug: r.salon_slug,
    designerId: r.designer_id ?? undefined,
    designerName: r.designer_name ?? undefined,
    customerId: r.customer_id ?? undefined,
    customerLocale: r.customer_locale,
    status: r.status,
    phone: r.phone ?? undefined,
    isReturning: r.is_returning,
    intake: r.intake,
    summary: r.summary ?? undefined,
    designerInput: r.designer_input ?? undefined,
    consultationToken: r.consultation_token,
    designerToken: r.designer_token,
    reportToken: r.report_token ?? undefined,
    designerReportToken: r.designer_report_token ?? undefined,
    beforePhotoUrl: r.before_photo_url ?? undefined,
    createdAt: r.created_at,
  };
}

function toCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    salonSlug: r.salon_slug,
    deviceToken: r.device_token ?? undefined,
    phone: r.phone ?? undefined,
    contactOptOut: r.contact_opt_out ?? false,
    locale: r.locale,
    isReturning: r.is_returning ?? false,
    createdAt: r.created_at,
  };
}

function toCustomerHairProfile(r: CustomerHairProfileRow): CustomerHairProfile {
  return {
    customerId: r.customer_id,
    faceShape: r.face_shape ?? undefined,
    crownVolume: r.crown_volume ?? undefined,
    hairDensity: r.hair_density ?? undefined,
    hairType: r.hair_type ?? undefined,
    cowlickWhorl: (r.cowlick_whorl as YesNoUnknown | null) ?? undefined,
    cowlickSticking: (r.cowlick_sticking as YesNoUnknown | null) ?? undefined,
    treatmentHistory: r.treatment_history ?? [],
    concernIds: r.concern_ids ?? [],
    styleNote: r.style_note ?? undefined,
    concernNote: r.concern_note ?? undefined,
    allergy: r.allergy ?? false,
    allergyNote: r.allergy_note ?? undefined,
    createdAt: r.created_at,
  };
}

function toTreatmentRecord(r: TreatmentRecordRow): TreatmentRecord {
  return {
    id: r.id,
    consultationId: r.consultation_id,
    customerId: r.customer_id ?? undefined,
    salonSlug: r.salon_slug ?? "",
    designerId: r.designer_id ?? undefined,
    designerName: r.designer_name ?? undefined,
    serviceIds: r.service_ids ?? [],
    products: r.products ?? [],
    stateGrade: r.state_grade ?? undefined,
    satisfactionScore: r.satisfaction_score ?? undefined,
    note: r.note ?? undefined,
    visitedAt: r.visited_at,
    salonId: r.salon_id ?? undefined,
    faceShape: r.face_shape ?? undefined,
    crownVolume: r.crown_volume ?? undefined,
    hairDensity: r.hair_density ?? undefined,
    hairType: r.hair_type ?? undefined,
    gender: r.gender ?? undefined,
    inputBy: r.input_by ?? undefined,
    servicesInputBy: r.services_input_by ?? undefined,
    allergyConfirmedByDesigner: r.allergy_confirmed_by_designer ?? undefined,
    hasBeforePhoto: r.has_before_photo ?? undefined,
    hasAfterPhoto: r.has_after_photo ?? undefined,
  };
}

function toMessage(r: MessageRow): Message {
  return {
    id: r.id,
    consultationId: r.consultation_id,
    sender: r.sender,
    sourceText: r.source_text,
    sourceLocale: r.source_locale,
    intent: r.intent ?? undefined,
    translations: r.translations ?? {},
    createdAt: r.created_at,
  };
}

function toHairReport(r: HairReportRow): HairReport {
  return {
    consultationId: r.consultation_id,
    reportToken: r.report_token,
    salonName: r.salon_name,
    designerName: r.designer_name,
    locale: r.locale,
    serviceSummary: r.service_summary,
    products: r.products ?? [],
    hairStateGrade: r.hair_state_grade,
    hairStateScore: r.hair_state_score,
    homeCare: r.home_care ?? [],
    nextVisitWeeks: r.next_visit_weeks,
    date: r.report_date,
    beforePhotoUrl: r.before_photo_url ?? undefined,
    afterPhotoUrl: r.after_photo_url ?? undefined,
    styleRequest: r.style_request ?? undefined,
    concerns: r.concerns ?? undefined,
    cautions: r.cautions ?? undefined,
  };
}

function toErrorLog(r: ErrorLogRow): ErrorLog {
  return {
    id: r.id,
    salonSlug: r.salon_slug ?? undefined,
    severity: r.severity,
    source: r.source,
    message: r.message,
    detail: r.detail ?? undefined,
    consultationId: r.consultation_id ?? undefined,
    createdAt: r.created_at,
  };
}

function toPushSub(r: PushSubRow): PushSub {
  return {
    id: r.id,
    designerId: r.designer_id,
    staffToken: r.staff_token,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
    createdAt: r.created_at,
  };
}

export class SupabaseRepo implements Repo {
  readonly driver = "supabase";

  constructor(private client: SupabaseClient) {}

  /* ── 살롱 ─────────────────────────────────────────────── */
  async getSalon(slug: string): Promise<Salon | null> {
    const { data, error } = await this.client
      .from("salons")
      .select(SALON_COLS)
      .eq("slug", slug)
      .maybeSingle();
    if (error) fail("getSalon", error);
    return data ? toSalon(data as SalonRow) : null;
  }

  async listSalons(): Promise<Salon[]> {
    const { data, error } = await this.client
      .from("salons")
      .select(SALON_COLS)
      .order("created_at", { ascending: true });
    if (error) fail("listSalons", error);
    return ((data ?? []) as SalonRow[]).map(toSalon);
  }

  async getSalonByOwnerToken(t: string): Promise<Salon | null> {
    if (!t) return null;
    const { data, error } = await this.client
      .from("salons")
      .select(SALON_COLS)
      .eq("owner_token", t)
      .maybeSingle();
    if (error) fail("getSalonByOwnerToken", error);
    return data ? toSalon(data as SalonRow) : null;
  }

  async createSalon(input: CreateSalonInput): Promise<Salon> {
    const row = {
      slug: input.slug,
      name: input.name,
      name_translations: input.nameTranslations ?? {},
      locales: input.locales ?? ["ja", "en", "ko"],
      address: input.address ?? null,
      tel: input.tel ?? null,
      business_hours: input.businessHours ?? null,
      placement_label: input.placementLabel ?? null,
      entry_key_version: 1,
      // 빈 직급이면 콘솔 디자이너 추가 직급 선택이 비어버린다 → 기본 직급으로 폴백.
      designer_ranks: input.designerRanks ?? DEFAULT_DESIGNER_RANKS,
      owner_token: `owner_${token()}`,
    };
    const { data, error } = await this.client
      .from("salons")
      .insert(row)
      .select(SALON_COLS)
      .single();
    if (error) fail("createSalon", error);
    return toSalon(data as SalonRow);
  }

  async updateSalonEntryKeyVersion(
    slug: string,
    version: number,
  ): Promise<void> {
    const { error } = await this.client
      .from("salons")
      .update({ entry_key_version: version })
      .eq("slug", slug);
    if (error) fail("updateSalonEntryKeyVersion", error);
  }

  async updateSalonRanks(
    salonSlug: string,
    ranks: DesignerRank[],
  ): Promise<void> {
    const { error } = await this.client
      .from("salons")
      .update({ designer_ranks: ranks })
      .eq("slug", salonSlug);
    if (error) fail("updateSalonRanks", error);
  }

  async updateSalonOwnerToken(
    salonSlug: string,
    ownerToken: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("salons")
      .update({ owner_token: ownerToken })
      .eq("slug", salonSlug);
    if (error) fail("updateSalonOwnerToken", error);
  }

  /* ── 디자이너(스태프) ──────────────────────────────────── */
  async getDesignerByStaffToken(t: string): Promise<Designer | null> {
    if (!t) return null;
    const { data, error } = await this.client
      .from("staff")
      .select(STAFF_COLS)
      .eq("staff_token", t)
      .maybeSingle();
    if (error) fail("getDesignerByStaffToken", error);
    return data ? toDesigner(data as StaffRow) : null;
  }

  async getDesignerById(id: string): Promise<Designer | null> {
    if (!id) return null;
    const { data, error } = await this.client
      .from("staff")
      .select(STAFF_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) fail("getDesignerById", error);
    return data ? toDesigner(data as StaffRow) : null;
  }

  async listDesigners(salonSlug: string): Promise<Designer[]> {
    const { data, error } = await this.client
      .from("staff")
      .select(STAFF_COLS)
      .eq("salon_slug", salonSlug)
      .order("created_at", { ascending: true });
    if (error) fail("listDesigners", error);
    return ((data ?? []) as StaffRow[]).map(toDesigner);
  }

  async createDesigner(input: CreateDesignerInput): Promise<Designer> {
    // salon_id(FK) 는 slug 로 해석.
    const { data: salon, error: salonErr } = await this.client
      .from("salons")
      .select("id")
      .eq("slug", input.salonSlug)
      .maybeSingle();
    if (salonErr) fail("createDesigner.salon", salonErr);
    if (!salon)
      throw new Error(
        `[supabase] createDesigner: unknown salon slug ${input.salonSlug}`,
      );

    const row = {
      id: input.id ?? `d_${token()}`,
      salon_id: (salon as { id: string }).id,
      salon_slug: input.salonSlug,
      name: input.name,
      staff_token: input.staffToken ?? `staff_${token()}`,
      entry_key_version: 1,
      rank_id: input.rankId ?? null,
    };
    const { data, error } = await this.client
      .from("staff")
      .insert(row)
      .select(STAFF_COLS)
      .single();
    if (error) fail("createDesigner", error);
    return toDesigner(data as StaffRow);
  }

  async updateDesigner(designer: Designer): Promise<void> {
    const { error } = await this.client
      .from("staff")
      .update({
        name: designer.name,
        rank_id: designer.rankId ?? null,
        entry_key_version: designer.entryKeyVersion,
      })
      .eq("id", designer.id);
    if (error) fail("updateDesigner", error);
  }

  /* ── 살롱별 시술 카탈로그 ───────────────────────────────── */
  async listServiceCategories(
    salonSlug: string,
  ): Promise<SalonServiceCategory[]> {
    const { data, error } = await this.client
      .from("salon_service_categories")
      .select(SALON_SERVICE_CATEGORY_COLS)
      .eq("salon_slug", salonSlug)
      .order("sort_order", { ascending: true });
    if (error) fail("listServiceCategories", error);
    return ((data ?? []) as SalonServiceCategoryRow[]).map(toServiceCategory);
  }

  async listServices(salonSlug: string): Promise<SalonService[]> {
    const { data, error } = await this.client
      .from("salon_services")
      .select(SALON_SERVICE_COLS)
      .eq("salon_slug", salonSlug);
    if (error) fail("listServices", error);
    return ((data ?? []) as SalonServiceRow[]).map(toService);
  }

  async upsertServiceCategory(category: SalonServiceCategory): Promise<void> {
    const { label_ko, label_translations } = fromLocalized(category.label);
    const row = {
      id: category.id,
      salon_slug: category.salonSlug,
      label_ko,
      label_translations,
      sort_order: category.sort,
    };
    const { error } = await this.client
      .from("salon_service_categories")
      .upsert(row, { onConflict: "id" });
    if (error) fail("upsertServiceCategory", error);
  }

  async upsertService(service: SalonService): Promise<void> {
    const { label_ko, label_translations } = fromLocalized(service.label);
    const row = {
      id: service.id,
      salon_slug: service.salonSlug,
      category_id: service.categoryId,
      label_ko,
      label_translations,
      base_price_from: service.basePriceFrom,
      rank_prices: service.rankPrices ?? {},
      active: service.active,
    };
    const { error } = await this.client
      .from("salon_services")
      .upsert(row, { onConflict: "id" });
    if (error) fail("upsertService", error);
  }

  async deleteService(id: string): Promise<void> {
    const { error } = await this.client
      .from("salon_services")
      .delete()
      .eq("id", id);
    if (error) fail("deleteService", error);
  }

  /* ── 상담 ─────────────────────────────────────────────── */
  async createConsultation(
    input: CreateConsultationInput,
  ): Promise<Consultation> {
    // salon_id(FK, not null)는 slug 로 해석한다.
    const { data: salon, error: salonErr } = await this.client
      .from("salons")
      .select("id")
      .eq("slug", input.salonSlug)
      .maybeSingle();
    if (salonErr) fail("createConsultation.salon", salonErr);
    if (!salon) throw new Error(`[supabase] createConsultation: unknown salon slug ${input.salonSlug}`);

    const row = {
      salon_id: (salon as { id: string }).id,
      salon_slug: input.salonSlug,
      designer_id: input.designerId ?? null,
      designer_name: input.designerName ?? null,
      customer_id: input.customerId ?? null,
      customer_locale: input.customerLocale,
      status: "intake" as ConsultationStatus,
      phone: input.phone ?? null,
      is_returning: input.isReturning,
      intake: input.intake,
      consultation_token: token(),
      designer_token: token(),
    };

    const { data, error } = await this.client
      .from("consultations")
      .insert(row)
      .select(CONSULTATION_COLS)
      .single();
    if (error) fail("createConsultation", error);
    return toConsultation(data as ConsultationRow);
  }

  async assignConsultation(
    consultationId: string,
    designer: { id: string; name: string },
  ): Promise<void> {
    const { error } = await this.client
      .from("consultations")
      .update({ designer_id: designer.id, designer_name: designer.name })
      .eq("id", consultationId);
    if (error) fail("assignConsultation", error);
  }

  async listConsultations(
    opts?: ListConsultationsOptions,
  ): Promise<Consultation[]> {
    let q = this.client
      .from("consultations")
      .select(CONSULTATION_COLS)
      .order("created_at", { ascending: false });
    if (opts?.salonSlug) q = q.eq("salon_slug", opts.salonSlug);
    if (opts?.designerId) q = q.eq("designer_id", opts.designerId);
    if (opts?.unassignedOnly) q = q.is("designer_id", null);
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) fail("listConsultations", error);
    return ((data ?? []) as ConsultationRow[]).map(toConsultation);
  }

  private async getByToken(
    column: "consultation_token" | "designer_token" | "report_token",
    value: string,
  ): Promise<Consultation | null> {
    if (!value) return null;
    const { data, error } = await this.client
      .from("consultations")
      .select(CONSULTATION_COLS)
      .eq(column, value)
      .maybeSingle();
    if (error) fail(`getBy:${column}`, error);
    return data ? toConsultation(data as ConsultationRow) : null;
  }

  getByConsultationToken(t: string): Promise<Consultation | null> {
    return this.getByToken("consultation_token", t);
  }
  getByDesignerToken(t: string): Promise<Consultation | null> {
    return this.getByToken("designer_token", t);
  }
  async getConsultationById(id: string): Promise<Consultation | null> {
    if (!id) return null;
    const { data, error } = await this.client
      .from("consultations")
      .select(CONSULTATION_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) fail("getConsultationById", error);
    return data ? toConsultation(data as ConsultationRow) : null;
  }
  getByReportToken(t: string): Promise<Consultation | null> {
    return this.getByToken("report_token", t);
  }

  async updateStatus(id: string, status: ConsultationStatus): Promise<void> {
    const { error } = await this.client
      .from("consultations")
      .update({ status })
      .eq("id", id);
    if (error) fail("updateStatus", error);
  }

  async setSummary(id: string, summary: DesignerSummary): Promise<void> {
    const { error } = await this.client
      .from("consultations")
      .update({ summary })
      .eq("id", id);
    if (error) fail("setSummary", error);
  }

  async setReportToken(id: string, reportToken: string): Promise<void> {
    const { error } = await this.client
      .from("consultations")
      .update({ report_token: reportToken })
      .eq("id", id);
    if (error) fail("setReportToken", error);
  }

  async setDesignerReportToken(
    consultationId: string,
    token: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("consultations")
      .update({ designer_report_token: token })
      .eq("id", consultationId);
    if (error) fail("setDesignerReportToken", error);
  }

  async setBeforePhoto(consultationId: string, url: string): Promise<void> {
    const { error } = await this.client
      .from("consultations")
      .update({ before_photo_url: url })
      .eq("id", consultationId);
    if (error) fail("setBeforePhoto", error);
  }

  async setDesignerInput(
    consultationId: string,
    input: DesignerHairInput,
  ): Promise<void> {
    const { error } = await this.client
      .from("consultations")
      .update({ designer_input: input })
      .eq("id", consultationId);
    if (error) fail("setDesignerInput", error);
  }

  async scrubConsultationPii(redacted: Consultation): Promise<void> {
    // 전화 컬럼 + intake JSONB + 시술전 사진 컬럼을 마스킹된 값으로 덮어쓴다
    // (사진·셀카·자유텍스트 원본 dataURL 제거).
    const { error } = await this.client
      .from("consultations")
      .update({
        phone: redacted.phone ?? null,
        intake: redacted.intake,
        before_photo_url: redacted.beforePhotoUrl ?? null,
      })
      .eq("id", redacted.id);
    if (error) fail("scrubConsultationPii", error);
  }

  /* ── 데이터 엔진: 손님 식별 / 카르테 ──────────────────────── */
  /** salonSlug → salon_id(uuid FK). 미존재 살롱이면 throw. */
  private async resolveSalonId(salonSlug: string): Promise<string> {
    const { data, error } = await this.client
      .from("salons")
      .select("id")
      .eq("slug", salonSlug)
      .maybeSingle();
    if (error) fail("resolveSalonId", error);
    if (!data)
      throw new Error(`[supabase] resolveSalonId: unknown salon slug ${salonSlug}`);
    return (data as { id: string }).id;
  }

  async getCustomerByDeviceToken(
    salonSlug: string,
    deviceToken: string,
  ): Promise<Customer | null> {
    if (!salonSlug || !deviceToken) return null;
    const { data, error } = await this.client
      .from("customers")
      .select(CUSTOMER_COLS)
      .eq("salon_slug", salonSlug)
      .eq("device_token", deviceToken)
      .maybeSingle();
    if (error) fail("getCustomerByDeviceToken", error);
    if (!data) return null;
    // 조회된 손님은 항상 재방문(신원 앵커 매칭).
    return { ...toCustomer(data as CustomerRow), isReturning: true };
  }

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const salonId = await this.resolveSalonId(input.salonSlug);
    const row = {
      salon_id: salonId,
      salon_slug: input.salonSlug,
      device_token: input.deviceToken,
      phone: input.phone ?? null,
      contact_opt_out: input.contactOptOut,
      locale: input.locale,
      is_returning: false,
    };
    const { data, error } = await this.client
      .from("customers")
      .insert(row)
      .select(CUSTOMER_COLS)
      .single();
    if (error) fail("createCustomer", error);
    return toCustomer(data as CustomerRow);
  }

  async upsertCustomerHairProfile(
    customerId: string,
    salonSlug: string,
    profile: CustomerHairProfileInput,
  ): Promise<void> {
    const salonId = await this.resolveSalonId(salonSlug);
    // customer_hair_profiles 는 customer 당 1:N(이력) — 최신 1건을 새로 insert.
    // getCustomerHairProfile 가 created_at desc 로 최신을 읽는다.
    const row = {
      customer_id: customerId,
      salon_id: salonId,
      face_shape: profile.faceShape ?? null,
      crown_volume: profile.crownVolume ?? null,
      hair_density: profile.hairDensity ?? null,
      hair_type: profile.hairType ?? null,
      cowlick_whorl: profile.cowlickWhorl ?? null,
      cowlick_sticking: profile.cowlickSticking ?? null,
      treatment_history: profile.treatmentHistory ?? [],
      concern_ids: profile.concernIds ?? [],
      style_note: profile.styleNote ?? null,
      concern_note: profile.concernNote ?? null,
      allergy: profile.allergy,
      allergy_note: profile.allergyNote ?? null,
    };
    const { error } = await this.client
      .from("customer_hair_profiles")
      .insert(row);
    if (error) fail("upsertCustomerHairProfile", error);
  }

  async getCustomerHairProfile(
    customerId: string,
  ): Promise<CustomerHairProfile | null> {
    if (!customerId) return null;
    const { data, error } = await this.client
      .from("customer_hair_profiles")
      .select(CUSTOMER_HAIR_PROFILE_COLS)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("getCustomerHairProfile", error);
    return data ? toCustomerHairProfile(data as CustomerHairProfileRow) : null;
  }

  async createTreatmentRecord(
    input: CreateTreatmentRecordInput,
  ): Promise<TreatmentRecord> {
    const salonId = await this.resolveSalonId(input.salonSlug);
    const row = {
      consultation_id: input.consultationId,
      customer_id: input.customerId ?? null,
      salon_id: salonId,
      salon_slug: input.salonSlug,
      designer_id: input.designerId ?? null,
      designer_name: input.designerName ?? null,
      service_ids: input.serviceIds,
      products: input.products,
      state_grade: input.stateGrade ?? null,
      satisfaction_score: input.satisfactionScore ?? null,
      note: input.note ?? null,
      face_shape: input.faceShape ?? null,
      crown_volume: input.crownVolume ?? null,
      hair_density: input.hairDensity ?? null,
      hair_type: input.hairType ?? null,
      gender: input.gender ?? null,
      input_by: input.inputBy ?? null,
      services_input_by: input.servicesInputBy ?? null,
      allergy_confirmed_by_designer: input.allergyConfirmedByDesigner ?? null,
      has_before_photo: input.hasBeforePhoto ?? null,
      has_after_photo: input.hasAfterPhoto ?? null,
    };
    const { data, error } = await this.client
      .from("treatment_records")
      .insert(row)
      .select(TREATMENT_RECORD_COLS)
      .single();
    if (error) fail("createTreatmentRecord", error);
    return toTreatmentRecord(data as TreatmentRecordRow);
  }

  async listCustomerTreatments(
    customerId: string,
  ): Promise<TreatmentRecord[]> {
    if (!customerId) return [];
    const { data, error } = await this.client
      .from("treatment_records")
      .select(TREATMENT_RECORD_COLS)
      .eq("customer_id", customerId)
      .order("visited_at", { ascending: false })
      .limit(200); // 카르테 표시·집계용 상한(폭증 방어).
    if (error) fail("listCustomerTreatments", error);
    return ((data ?? []) as TreatmentRecordRow[]).map(toTreatmentRecord);
  }

  async saveTrainingSample(s: TrainingSample): Promise<void> {
    // 비식별 학습 샘플 적재(PII 컬럼 없음). 실패는 호출부에서 best-effort 처리.
    const { error } = await this.client.from("training_samples").insert({
      salon_slug: s.salonSlug,
      customer_pseudonym: s.customerPseudonym,
      visited_at: s.visitedAt,
      nationality: s.nationality ?? null,
      gender: s.gender ?? null,
      age_band: s.ageBand ?? null,
      face_shape: s.faceShape ?? null,
      crown_volume: s.crownVolume ?? null,
      hair_density: s.hairDensity ?? null,
      hair_type: s.hairType ?? null,
      concern_ids: s.concernIds,
      allergy: s.allergy,
      service_ids: s.serviceIds,
      products: s.products,
      state_grade: s.stateGrade ?? null,
      hair_state_score: s.hairStateScore ?? null,
      satisfaction_score: s.satisfactionScore ?? null,
      next_visit_weeks: s.nextVisitWeeks ?? null,
      input_by: s.inputBy ?? null,
      services_input_by: s.servicesInputBy ?? null,
      designer_id: s.designerId ?? null,
      has_before_photo: s.hasBeforePhoto ?? null,
      has_after_photo: s.hasAfterPhoto ?? null,
    });
    if (error) fail("saveTrainingSample", error);
  }

  async getTreatmentByConsultation(
    consultationId: string,
  ): Promise<TreatmentRecord | null> {
    if (!consultationId) return null;
    const { data, error } = await this.client
      .from("treatment_records")
      .select(TREATMENT_RECORD_COLS)
      .eq("consultation_id", consultationId)
      .order("visited_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("getTreatmentByConsultation", error);
    return data ? toTreatmentRecord(data as TreatmentRecordRow) : null;
  }

  async getLastConsultationForCustomer(
    customerId: string,
  ): Promise<Consultation | null> {
    if (!customerId) return null;
    const { data, error } = await this.client
      .from("consultations")
      .select(CONSULTATION_COLS)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("getLastConsultationForCustomer", error);
    return data ? toConsultation(data as ConsultationRow) : null;
  }

  /* ── 메시지 ───────────────────────────────────────────── */
  async addMessage(msg: NewMessage): Promise<Message> {
    const row = {
      consultation_id: msg.consultationId,
      sender: msg.sender,
      source_text: msg.sourceText,
      source_locale: msg.sourceLocale,
      intent: msg.intent ?? null,
      translations: msg.translations ?? {},
      ...(msg.createdAt ? { created_at: msg.createdAt } : {}),
    };
    const { data, error } = await this.client
      .from("messages")
      .insert(row)
      .select(MESSAGE_COLS)
      .single();
    if (error) fail("addMessage", error);
    return toMessage(data as MessageRow);
  }

  async listMessages(
    consultationId: string,
    sinceIso?: string,
  ): Promise<Message[]> {
    let q = this.client
      .from("messages")
      .select(MESSAGE_COLS)
      .eq("consultation_id", consultationId)
      .order("created_at", { ascending: true });
    if (sinceIso) q = q.gt("created_at", sinceIso);
    const { data, error } = await q;
    if (error) fail("listMessages", error);
    return ((data ?? []) as MessageRow[]).map(toMessage);
  }

  /* ── 리포트 ───────────────────────────────────────────── */
  async saveReport(report: HairReport): Promise<void> {
    const row = {
      consultation_id: report.consultationId,
      report_token: report.reportToken,
      salon_name: report.salonName,
      designer_name: report.designerName,
      locale: report.locale,
      service_summary: report.serviceSummary,
      products: report.products,
      hair_state_grade: report.hairStateGrade,
      hair_state_score: report.hairStateScore,
      home_care: report.homeCare,
      next_visit_weeks: report.nextVisitWeeks,
      report_date: report.date,
      before_photo_url: report.beforePhotoUrl ?? null,
      after_photo_url: report.afterPhotoUrl ?? null,
      style_request: report.styleRequest ?? null,
      concerns: report.concerns ?? null,
      cautions: report.cautions ?? null,
    };
    const { error } = await this.client
      .from("hair_reports")
      .upsert(row, { onConflict: "report_token" });
    if (error) fail("saveReport", error);
  }

  async getReport(reportToken: string): Promise<HairReport | null> {
    if (!reportToken) return null;
    const { data, error } = await this.client
      .from("hair_reports")
      .select(REPORT_COLS)
      .eq("report_token", reportToken)
      .maybeSingle();
    if (error) fail("getReport", error);
    return data ? toHairReport(data as HairReportRow) : null;
  }

  /* ── 디자이너 웹푸시 구독 ─────────────────────────────────── */
  async savePushSubscription(input: NewPushSub): Promise<void> {
    const row = {
      designer_id: input.designerId,
      staff_token: input.staffToken,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    };
    const { error } = await this.client
      .from("push_subscriptions")
      .upsert(row, { onConflict: "endpoint" });
    if (error) fail("savePushSubscription", error);
  }

  async listPushSubscriptions(designerId: string): Promise<PushSub[]> {
    if (!designerId) return [];
    const { data, error } = await this.client
      .from("push_subscriptions")
      .select(PUSH_SUB_COLS)
      .eq("designer_id", designerId);
    if (error) fail("listPushSubscriptions", error);
    return ((data ?? []) as PushSubRow[]).map(toPushSub);
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    if (!endpoint) return;
    const { error } = await this.client
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);
    if (error) fail("deletePushSubscription", error);
  }

  /* ── 에러 로그 ────────────────────────────────────────── */
  async logError(entry: NewErrorLog): Promise<ErrorLog> {
    const row = {
      salon_slug: entry.salonSlug ?? null,
      severity: entry.severity,
      source: entry.source,
      message: entry.message,
      detail: entry.detail ?? null,
      consultation_id: entry.consultationId ?? null,
      ...(entry.createdAt ? { created_at: entry.createdAt } : {}),
    };
    const { data, error } = await this.client
      .from("error_logs")
      .insert(row)
      .select(ERROR_COLS)
      .single();
    if (error) fail("logError", error);
    return toErrorLog(data as ErrorLogRow);
  }

  async listErrors(opts?: ListConsultationsOptions): Promise<ErrorLog[]> {
    let q = this.client
      .from("error_logs")
      .select(ERROR_COLS)
      .order("created_at", { ascending: false });
    if (opts?.salonSlug) q = q.eq("salon_slug", opts.salonSlug);
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) fail("listErrors", error);
    return ((data ?? []) as ErrorLogRow[]).map(toErrorLog);
  }

  /**
   * 고정 윈도우 레이트리밋(P0) — 0003_rate_limits.sql 의 rate_limit_hit() RPC 로
   * (bucket, window_start) 행을 원자적으로 +1 하고 증가 후 count 를 반환.
   * 서버리스 멀티인스턴스에서도 공유 카운터가 보장된다.
   * 실패(권한/네트워크 등) 시 0 을 돌려 서비스 차단을 유발하지 않는다(가용성 우선).
   */
  async rateLimitHit(bucket: string, windowStartMs: number): Promise<number> {
    const { data, error } = await this.client.rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_window_start: new Date(windowStartMs).toISOString(),
    });
    if (error) {
      console.error("[sotong] rateLimitHit RPC failed", error);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  }
}
