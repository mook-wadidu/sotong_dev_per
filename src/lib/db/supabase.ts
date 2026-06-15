import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Consultation,
  ConsultationStatus,
  DesignerSummary,
  HairReport,
  IntakeDraft,
  Locale,
  LocalizedText,
  Message,
  MessageSender,
  QuickReplyIntent,
} from "@/lib/domain/types";
import type {
  CreateConsultationInput,
  CreateDesignerInput,
  CreateSalonInput,
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
  designer_ranks: DesignerRank[] | null;
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
  customer_locale: Locale;
  status: ConsultationStatus;
  phone: string | null;
  is_returning: boolean;
  intake: IntakeDraft;
  summary: DesignerSummary | null;
  consultation_token: string;
  designer_token: string;
  report_token: string | null;
  created_at: string;
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
  "id,salon_slug,designer_id,designer_name,customer_locale,status,phone,is_returning,intake,summary,consultation_token,designer_token,report_token,created_at";
const MESSAGE_COLS =
  "id,consultation_id,sender,source_text,source_locale,intent,translations,created_at";
const REPORT_COLS =
  "consultation_id,report_token,salon_name,designer_name,locale,service_summary,products,hair_state_grade,hair_state_score,home_care,next_visit_weeks,report_date,before_photo_url,after_photo_url";
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
    designerRanks: r.designer_ranks ?? [],
    ownerToken: r.owner_token,
  };
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
    customerLocale: r.customer_locale,
    status: r.status,
    phone: r.phone ?? undefined,
    isReturning: r.is_returning,
    intake: r.intake,
    summary: r.summary ?? undefined,
    consultationToken: r.consultation_token,
    designerToken: r.designer_token,
    reportToken: r.report_token ?? undefined,
    createdAt: r.created_at,
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
      designer_ranks: input.designerRanks ?? [],
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
}
