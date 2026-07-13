import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { getRepo } from "@/lib/db";
import { config } from "@/lib/config";
import {
  DEFAULT_DESIGNER_RANKS,
  toPublicSalon,
  toOwnerConsoleSalon,
  type OwnerConsoleSalon,
  type AdminDesigner,
  type AdminSalon,
  type Announcement,
  type AnnouncementAudience,
  type MembershipRequest,
  type SupportNote,
  type NewSupportNote,
  type ConsultationListItem,
  type Designer,
  type DesignerRank,
  type ErrorLog,
  type ErrorSeverity,
  type NewAnnouncement,
  type PublicSalon,
  type Salon,
  type SalonService,
  type SalonServiceCategory,
} from "@/lib/db/types";
import type { LocalizedText } from "@/lib/domain/types";
import { getAi } from "@/lib/ai";
import {
  concernLabels,
  faceShapeLabel,
  formatKRW,
  formatPrice,
  PRODUCTS,
  QUICK_REPLIES,
  TIME_PRESETS,
  CROWN_VOLUME,
  HAIR_DENSITY,
  HAIR_TYPE,
  INTAKE_CATEGORIES,
} from "@/lib/catalog";
import {
  makeDesignerEntryToken,
  makeSalonEntryToken,
  verifyEntryToken,
} from "@/lib/entry";
import { readAdminSession } from "@/lib/admin-session";
import { getAdminUser, isAdminEmail } from "@/lib/admin-auth";
import { provisionAccount } from "@/lib/account-provision";
import { getSessionAccount } from "@/lib/session-auth";
import {
  customerEntryPath,
  designerInboxPath,
  designerSummaryPath,
  invitePath,
  salonConsolePath,
} from "@/lib/links";
import { sendWebPush } from "@/lib/push";
import { ensureDeviceToken, readDeviceToken } from "@/lib/device";
import {
  getAdminAnalytics,
  type AdminAnalytics,
  type AnalyticsRange,
} from "@/lib/admin-analytics";
import {
  getAdminDesigners,
  type AdminDesignerStats,
} from "@/lib/admin-designers";
import { getAdminReports, type AdminReportRow } from "@/lib/admin-reports";
import {
  ageBand,
  NATIONALITY_BY_LOCALE,
  type Consultation,
  type ConsultationStatus,
  type Customer,
  type CustomerHairProfile,
  type DesignerHairInput,
  type HairReport,
  type IntakeDraft,
  type Locale,
  type TrainingSample,
  type Message,
  type QuickReplyIntent,
  type FaceShape,
  type HairType,
  type ThreeLevel,
  type TreatmentHistoryItem,
  type TreatmentRecency,
  type TreatmentRecord,
  type TreatmentType,
  type YesNoUnknown,
} from "@/lib/domain/types";

/* ── 레이트리밋 (고정 윈도우, 공유 스토어) ─────────────────────
 * QR 토큰/세션당 윈도우 상한으로 위조·어뷰즈 폭주를 차단(P0).
 * 저장은 repo.rateLimitHit 에 위임 — supabase 드라이버는 DB 백드(서버리스 멀티인스턴스
 * 공유), memory 드라이버는 인프로세스 폴백. 윈도우 시작을 floor 로 양자화해
 * 같은 키의 같은 윈도우가 모든 인스턴스에서 동일 버킷을 쓰도록 한다. */
class RateLimitError extends Error {
  constructor(msg = "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.") {
    super(msg);
    this.name = "RateLimitError";
  }
}

/**
 * key 에 대해 windowMs 윈도우 내 최대 max 회 허용. 초과 시 logIssue + throw.
 * repo.rateLimitHit 의 증가 후 count 가 max 를 넘으면 차단한다.
 */
async function enforceRate(
  key: string,
  max: number,
  windowMs: number,
  ctx: { salonSlug?: string; source: string; consultationId?: string },
): Promise<void> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  let count: number;
  try {
    count = await getRepo().rateLimitHit(key, windowStart);
  } catch (e) {
    // 리미터 자체 실패는 서비스를 막지 않는다(가용성 우선) — 흔적만 남긴다.
    console.error("[sotong] enforceRate failed (allowing)", e);
    return;
  }
  // count===0 은 리미터 비가용(폴백 통과). 정상 경로는 1 이상.
  if (count === 0 || count <= max) return;
  // key 에 capability 토큰이 섞여 있으므로 로그엔 프리픽스 + 꼬리 6자만(재사용 방지).
  const dot = key.indexOf(":");
  const safeKey =
    dot > 0 ? `${key.slice(0, dot)}:…${key.slice(-6)}` : key.slice(0, 12);
  await logIssue({
    salonSlug: ctx.salonSlug,
    severity: "warning",
    source: ctx.source,
    message: "레이트리밋 초과",
    detail: `key=${safeKey} count=${count} max=${max}/${windowMs}ms`,
    consultationId: ctx.consultationId,
  });
  throw new RateLimitError();
}

/** 공개 rate 체크(라우트핸들러용) — 초과면 false, 아니면 true(throw 안 함). */
export async function rateLimitOk(
  key: string,
  max: number,
  windowMs: number,
  source: string,
): Promise<boolean> {
  try {
    await enforceRate(key, max, windowMs, { source });
    return true;
  } catch {
    return false;
  }
}

/* ── 사진 dataURL 검증 (서버 입력 경계, P0) ───────────────────
 * 클라가 서버액션을 직접 호출해 거대/임의 dataURL 을 무제한 저장하는 어뷰즈를 막는다.
 * - 개수 ≤ MAX_PHOTOS
 * - 각 dataURL 길이 ≤ MAX_DATAURL_LEN (~1.5MB; base64 는 원본의 ~1.33배)
 * - MIME 화이트리스트: jpeg/png/webp 만(svg+xml 등 거부) */
const MAX_PHOTOS = 5;
const MAX_DATAURL_LEN = 1_500_000;
const DATAURL_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** 단일 사진 dataURL 검증 — 통과 시 true. */
function isValidPhotoDataUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    url.length <= MAX_DATAURL_LEN &&
    DATAURL_RE.test(url)
  );
}

class PhotoValidationError extends Error {
  constructor(msg = "사진 형식이 올바르지 않습니다.") {
    super(msg);
    this.name = "PhotoValidationError";
  }
}

/**
 * 사진 배열 검증 — 개수/길이/MIME 위반 시 logIssue + throw.
 * undefined 는 허용(사진 없음). 위반 1건이라도 있으면 전체 거부(부분 저장 방지).
 */
async function assertValidPhotos(
  urls: string[] | undefined,
  ctx: { salonSlug?: string; source: string; consultationId?: string },
): Promise<void> {
  if (!urls || urls.length === 0) return;
  const reject = async (reason: string): Promise<never> => {
    await logIssue({
      salonSlug: ctx.salonSlug,
      severity: "warning",
      source: ctx.source,
      message: "사진 dataURL 검증 실패(거부)",
      detail: reason,
      consultationId: ctx.consultationId,
    });
    throw new PhotoValidationError();
  };
  if (urls.length > MAX_PHOTOS) {
    return reject(`개수 초과 ${urls.length}>${MAX_PHOTOS}`);
  }
  for (const url of urls) {
    if (!isValidPhotoDataUrl(url)) {
      return reject(`형식/길이 위반 len=${(url as string)?.length ?? 0}`);
    }
  }
}

/* ── 에러 로깅 (어드민 모니터링용) ─────────────────────── */
export async function logIssue(entry: {
  salonSlug?: string;
  severity?: ErrorSeverity;
  source: string;
  message: string;
  detail?: string;
  consultationId?: string;
}): Promise<void> {
  try {
    await getRepo().logError({
      salonSlug: entry.salonSlug,
      severity: entry.severity ?? "error",
      source: entry.source,
      message: entry.message,
      detail: entry.detail,
      consultationId: entry.consultationId,
    });
  } catch (e) {
    console.error("[sotong] logIssue failed", e);
  }
}

/* ── 디자이너 웹푸시 ─────────────────────────────────────────
 * 구독 저장(saveDesignerPush) + 알림 발송(notifyDesigner).
 * 발송은 메인 플로우(인테이크/상담)를 절대 막지 않는다 — throw 금지. */

/** 디자이너 PWA 구독 저장 — staffToken 으로 디자이너 확정 후 endpoint upsert. */
export async function saveDesignerPush(
  staffToken: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<{ ok: boolean }> {
  const repo = getRepo();
  // 레이트리밋(P0) — staffToken 당 분당 구독 저장 상한(구독 행 폭증 방지).
  // 초과 시 logIssue+throw 대신 메인 플로우 보호 차원에서 throw 를 그대로 전파(어뷰즈 차단).
  await enforceRate(`push:${staffToken}`, 20, 60_000, { source: "push" });
  const designer = await repo.getDesignerByStaffToken(staffToken);
  if (!designer) {
    await logIssue({
      severity: "warning",
      source: "push",
      message: "푸시 구독 staffToken 검증 실패",
    });
    return { ok: false };
  }
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    await logIssue({
      salonSlug: designer.salonSlug,
      severity: "warning",
      source: "push",
      message: "푸시 구독 정보 누락(endpoint/keys)",
    });
    return { ok: false };
  }
  try {
    await repo.savePushSubscription({
      designerId: designer.id,
      staffToken,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
    return { ok: true };
  } catch (e) {
    await logIssue({
      salonSlug: designer.salonSlug,
      source: "push",
      message: "푸시 구독 저장 실패",
      detail: e instanceof Error ? e.message : String(e),
    });
    return { ok: false };
  }
}

/**
 * 디자이너에게 웹푸시 발송 — 그 디자이너의 모든 구독으로 시도.
 * 만료(gone) 구독은 정리한다. 어떤 실패도 throw 하지 않는다(메인 플로우 보호).
 */
export async function notifyDesigner(
  designerId: string,
  payload: { title: string; body: string; url: string },
  ctx?: { salonSlug?: string; consultationId?: string; kind?: string },
): Promise<void> {
  let status = "no_subscription";
  try {
    const repo = getRepo();
    const subs = await repo.listPushSubscriptions(designerId);
    let sent = 0;
    for (const sub of subs) {
      const res = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      );
      if (res.gone) {
        await repo.deletePushSubscription(sub.endpoint);
      } else if (res.ok) {
        sent += 1; // 실제 전송 성공만 카운트(비활성/5xx는 실패로).
      }
    }
    status = subs.length === 0 ? "no_subscription" : sent > 0 ? "sent" : "failed";
  } catch (e) {
    status = "failed";
    await logIssue({
      source: "push",
      message: "디자이너 알림 발송 실패",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  // 발송 현황 로그(best-effort — 실패해도 무시).
  try {
    await getRepo().logNotification({
      salonSlug: ctx?.salonSlug,
      designerId,
      consultationId: ctx?.consultationId,
      kind: ctx?.kind ?? "new_consultation",
      status,
    });
  } catch {
    /* 로그 실패 무시 */
  }
}

function levelLabel(items: { id: string; label: LocalizedText }[], id?: string) {
  if (!id) return undefined;
  return items.find((i) => i.id === id)?.label.ko;
}

/* ── 최근 시술 이력 / 가마·뻗침 한국어 라벨 (요약용) ─────────── */
const TREATMENT_TYPE_KO: Record<TreatmentType, string> = {
  cut: "컷",
  perm: "펌",
  color: "염색",
  care: "클리닉/케어",
};
const TREATMENT_RECENCY_KO: Record<TreatmentRecency, string> = {
  "2w": "2주 내",
  "1m": "1개월 내",
  "3m": "3개월 내",
  older: "그 이전",
};

/** treatmentHistory → ["염색(2주 내)", ...] 한국어 라벨 배열. */
function treatmentHistoryLabelsKo(items: TreatmentHistoryItem[]): string[] {
  return items.map(
    (h) => `${TREATMENT_TYPE_KO[h.type]}(${TREATMENT_RECENCY_KO[h.recency]})`,
  );
}

/** 가마/뻗침 → "가마 있음 · 뻗침 있음" 한국어 한 줄(둘 다 미입력/unknown 이면 undefined). */
function cowlickKo(
  whorl?: YesNoUnknown,
  sticking?: YesNoUnknown,
): string | undefined {
  const parts: string[] = [];
  if (whorl === "yes") parts.push("가마 있음");
  else if (whorl === "no") parts.push("가마 없음");
  if (sticking === "yes") parts.push("뻗침 있음");
  else if (sticking === "no") parts.push("뻗침 없음");
  return parts.length ? parts.join(" · ") : undefined;
}

/* ── 인테이크 → 손님 모발 프로필(재방문 프리필 소스) ──────────
 * IntakeDraft 의 프로필 부분집합만 추출(연락/사진/동의/서비스 선택 제외).
 * upsertCustomerHairProfile 의 CustomerHairProfileInput 형태로 반환. */
function intakeToHairProfile(intake: IntakeDraft): Omit<
  CustomerHairProfile,
  "customerId" | "createdAt"
> {
  return {
    faceShape: intake.faceShape,
    crownVolume: intake.crownVolume,
    hairDensity: intake.hairDensity,
    hairType: intake.hairType,
    cowlickWhorl: intake.cowlickWhorl,
    cowlickSticking: intake.cowlickSticking,
    treatmentHistory: intake.treatmentHistory,
    concernIds: intake.concernIds,
    styleNote: intake.styleNote,
    concernNote: intake.concernNote,
    // 인테이크에서 명시 답변을 강제하므로 여기 도달 시 정의됨. 방어적으로 false 폴백.
    allergy: intake.allergy ?? false,
    allergyNote: intake.allergyNote,
  };
}

/* ── 살롱별 메뉴 해석 (전역 catalog 대체) ─────────────────────
 * 디자이너가 배정되면 그 디자이너 rankId 의 rankPrices 를 우선,
 * 없으면 basePriceFrom. serviceIds(살롱 서비스 id) 기준. */
function priceForService(svc: SalonService, rankId?: string): number {
  if (rankId && svc.rankPrices && typeof svc.rankPrices[rankId] === "number") {
    return svc.rankPrices[rankId];
  }
  return svc.basePriceFrom;
}

/** serviceIds → 살롱 서비스 객체(존재·active 만). 순서는 serviceIds 따름. */
function resolveServices(
  serviceIds: string[],
  services: SalonService[],
): SalonService[] {
  const byId = new Map(services.map((s) => [s.id, s]));
  return serviceIds
    .map((id) => byId.get(id))
    .filter((s): s is SalonService => Boolean(s) && (s as SalonService).active);
}

/** 선택 시술의 예상가 합(KRW). 없으면 null. (디자이너 rank 가격 우선) */
function estimateSalonPrice(
  serviceIds: string[],
  services: SalonService[],
  rankId?: string,
): number | null {
  const resolved = resolveServices(serviceIds, services);
  if (!resolved.length) return null;
  return resolved.reduce((sum, s) => sum + priceForService(s, rankId), 0);
}

/* ── 인테이크 메뉴 (C2 가 호출) ───────────────────────────────
 * 입장 토큰 → 살롱/디자이너 확정 후, 그 살롱의 편집 가능한 시술 메뉴를 돌려준다.
 * priceFrom 은 디자이너 토큰이면 그 디자이너 rankPrices 우선(없으면 basePriceFrom),
 * 살롱 공용이면 basePriceFrom. */
export interface IntakeMenuCategory {
  id: string;
  label: LocalizedText;
  sort: number;
}
export interface IntakeMenuService {
  id: string;
  categoryId: string;
  label: LocalizedText;
  priceFrom: number;
}
export interface IntakeMenu {
  salonName: string;
  nameTranslations?: Partial<Record<Locale, string>>;
  categories: IntakeMenuCategory[];
  services: IntakeMenuService[];
}

export async function getIntakeMenu(
  entryToken: string,
): Promise<IntakeMenu | null> {
  const repo = getRepo();
  // 레이트리밋(P0) — 입장 토큰당 분당 메뉴 조회 상한.
  await enforceRate(`intake-menu:${entryToken}`, 60, 60_000, {
    source: "intake-menu",
  });
  const resolved = await resolveEntry(entryToken, "intake-menu");
  if (!resolved) return null;
  const salon = await repo.getSalon(resolved.salonSlug);
  if (!salon) return null;

  // 디자이너 토큰이면 그 디자이너 직급으로 가격 보정.
  let rankId: string | undefined;
  if (resolved.designerId) {
    const designer = await repo.getDesignerById(resolved.designerId);
    rankId = designer?.rankId;
  }

  const [categories, services] = await Promise.all([
    repo.listServiceCategories(salon.slug),
    repo.listServices(salon.slug),
  ]);

  return {
    salonName: salon.name,
    nameTranslations: salon.nameTranslations,
    categories: categories.map((c) => ({
      id: c.id,
      label: c.label,
      sort: c.sort,
    })),
    services: services
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        label: s.label,
        priceFrom: priceForService(s, rankId),
      })),
  };
}

/**
 * 입장 토큰 → 살롱/디자이너 확정(서버 권위). 클라가 보낸 slug 는 절대 신뢰하지 않는다.
 * - 디자이너 토큰: getDesignerById 로 salonSlug/디자이너 확정 + designer.entryKeyVersion 대조
 * - 살롱 공용 토큰: salonSlug 확정·미배정 + salon.entryKeyVersion 대조
 * 실패(무효/버전불일치) → logIssue(warning) + null.
 */
async function resolveEntry(
  entryToken: string,
  source: string,
): Promise<{
  salonSlug: string;
  designerId?: string;
  designerName?: string;
  designer?: Designer;
} | null> {
  const repo = getRepo();
  const verified = verifyEntryToken(entryToken);
  if (!verified) {
    await logIssue({
      severity: "warning",
      source: "entry",
      message: `입장 토큰 검증 실패(위조/만료 가능, ${source})`,
      detail: `token=${entryToken.slice(0, 12)}…`,
    });
    return null;
  }

  if (verified.kind === "designer") {
    const designer = await repo.getDesignerById(verified.designerId);
    if (!designer || designer.entryKeyVersion !== verified.version) {
      await logIssue({
        salonSlug: designer?.salonSlug,
        severity: "warning",
        source: "entry",
        message: `디자이너 입장 토큰 무효/키 버전 불일치(폐기된 QR 가능, ${source})`,
        detail: `designerId=${verified.designerId} token.v=${verified.version} designer.v=${designer?.entryKeyVersion ?? "none"}`,
      });
      return null;
    }
    return {
      salonSlug: designer.salonSlug,
      designerId: designer.id,
      designerName: designer.name,
      designer,
    };
  }

  // salon (공용/지정없음)
  const salon = await repo.getSalon(verified.salonSlug);
  if (!salon || salon.entryKeyVersion !== verified.version) {
    await logIssue({
      salonSlug: verified.salonSlug,
      severity: "warning",
      source: "entry",
      message: `살롱 입장 토큰 무효/키 버전 불일치(폐기된 QR 가능, ${source})`,
      detail: `token.v=${verified.version} salon.v=${salon?.entryKeyVersion ?? "none"}`,
    });
    return null;
  }
  return { salonSlug: salon.slug };
}

/* ── 인테이크 제출 → 상담 생성 + AI 한국어 요약 ──────────
 * QR 입장 토큰만 신뢰한다. 클라가 보낸 salonSlug 는 받지 않는다(P0).
 * - verifyEntryToken 실패 → logIssue(warning) + throw
 * - 동의(consentedAt) 없으면 차단(P0)
 * - 토큰당 레이트리밋(P0) */
export async function startConsultation(input: {
  entryToken: string;
  customerLocale: Locale;
  isReturning: boolean;
  intake: IntakeDraft;
}): Promise<{ consultationToken: string; consultationId: string }> {
  // 주의(보안): designerToken 은 손님에게 반환하지 않는다 — 손님이 그것으로 /d/summary 를
  // 열면 staffToken 이 노출돼 디자이너 인박스가 탈취된다. 디자이너는 push 로 링크를 받는다.
  const repo = getRepo();

  // 1) 입장 토큰 검증 — 서버가 salonSlug/디자이너를 확정(클라 신뢰 금지)
  const resolved = await resolveEntry(input.entryToken, "intake");
  if (!resolved) throw new Error("유효하지 않은 입장 토큰입니다.");
  const { salonSlug, designerId, designerName, designer } = resolved;

  // 2) 레이트리밋 — 입장 토큰당 분당 상담 생성 상한
  await enforceRate(`intake:${input.entryToken}`, 8, 60_000, {
    salonSlug,
    source: "intake",
  });

  // 2.5) 사진 dataURL 검증(P0) — 개수/길이/MIME 위반 시 거부(거대·임의 dataURL 어뷰즈 차단)
  await assertValidPhotos(input.intake.stylePhotoUrls, {
    salonSlug,
    source: "intake",
  });

  // 3) 동의 게이트 — 개인정보·사진 수집 동의 없으면 제출 차단
  if (!input.intake.consentedAt) {
    await logIssue({
      salonSlug,
      severity: "warning",
      source: "intake",
      message: "동의(consentedAt) 없이 제출 차단",
    });
    throw new Error("개인정보·사진 수집 동의가 필요합니다.");
  }

  // 4) 전화번호는 옵셔널 — 없거나 contactOptOut 이면 그대로 진행
  const phone =
    input.intake.contactOptOut || !input.intake.phone?.trim()
      ? undefined
      : input.intake.phone.trim();

  // 4.5) 기기 토큰 식별(신원 앵커) — 클라 input.isReturning 은 무시(서버 권위).
  //   매칭 customer 있으면 재방문(isReturning=true), 없으면 신규 생성.
  //   토큰/조회 실패는 메인 플로우를 막지 않는다(best-effort) — 미식별로 진행.
  let customer: Customer | null = null;
  let isReturning = false;
  try {
    const deviceToken = await ensureDeviceToken();
    customer = await repo.getCustomerByDeviceToken(salonSlug, deviceToken);
    if (customer) {
      isReturning = true; // getCustomerByDeviceToken 매칭 → 항상 재방문
    } else {
      customer = await repo.createCustomer({
        salonSlug,
        deviceToken,
        phone,
        contactOptOut: !!input.intake.contactOptOut,
        locale: input.customerLocale,
      });
      isReturning = false;
    }
  } catch (e) {
    await logIssue({
      salonSlug,
      severity: "warning",
      source: "intake",
      message: "기기 토큰 식별 실패(미식별로 진행)",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 4.6) 단골 라우팅용 '지난 담당' 포착 — **이번 상담 생성 전에** 조회해야 정확하다.
  //   (생성 후엔 방금 만든 미배정 상담이 최신이 되어 지난 담당을 못 잡는다.)
  let priorDesignerId: string | undefined;
  if (customer && isReturning) {
    try {
      const last = await repo.getLastConsultationForCustomer(customer.id);
      priorDesignerId = last?.designerId;
    } catch {
      // best-effort — 실패 시 단골 라우팅 없이 진행.
    }
  }

  try {
    const consultation = await repo.createConsultation({
      salonSlug,
      designerId,
      designerName,
      customerLocale: input.customerLocale,
      isReturning,
      phone,
      intake: input.intake,
      customerId: customer?.id,
    });

    // 손님 모발 프로필 영속(재방문 프리필 소스) — best-effort(실패해도 상담은 진행).
    if (customer) {
      try {
        await repo.upsertCustomerHairProfile(
          customer.id,
          salonSlug,
          intakeToHairProfile(input.intake),
        );
      } catch (e) {
        await logIssue({
          salonSlug,
          severity: "warning",
          source: "intake",
          message: "손님 모발 프로필 저장 실패",
          detail: e instanceof Error ? e.message : String(e),
          consultationId: consultation.id,
        });
      }
    }

    // 살롱 메뉴 기준으로 라벨/예상가 해석(전역 catalog 대신 listServices).
    const salonServices = await repo.listServices(salonSlug);
    const resolvedServices = resolveServices(
      input.intake.serviceIds,
      salonServices,
    );
    // MVP: 손님은 큰 분류만 고른다 → 요약 시술명은 분류 라벨(ko). 레거시(serviceIds) 폴백.
    const categoryLabelsKo = (input.intake.serviceCategoryIds ?? [])
      .map((id) => INTAKE_CATEGORIES.find((c) => c.id === id)?.label.ko)
      .filter((x): x is string => !!x);
    const serviceLabelsKo = categoryLabelsKo.length
      ? categoryLabelsKo
      : resolvedServices.map((s) => s.label.ko);
    const priceWon = estimateSalonPrice(
      input.intake.serviceIds,
      salonServices,
      designer?.rankId,
    );

    const ai = getAi();
    const summary = await ai.summarizeIntake({
      customerLocale: input.customerLocale,
      isReturning,
      intake: input.intake,
      serviceLabelsKo,
      concernLabelsKo: concernLabels(input.intake.concernIds, "ko"),
      treatmentHistoryLabelsKo: treatmentHistoryLabelsKo(
        input.intake.treatmentHistory,
      ),
      faceShapeKo: faceShapeLabel(input.intake.faceShape, "ko"),
      crownVolumeKo: levelLabel(CROWN_VOLUME, input.intake.crownVolume),
      hairDensityKo: levelLabel(HAIR_DENSITY, input.intake.hairDensity),
      hairTypeKo: levelLabel(HAIR_TYPE, input.intake.hairType),
      cowlickKo: cowlickKo(
        input.intake.cowlickWhorl,
        input.intake.cowlickSticking,
      ),
      styleNote: input.intake.styleNote,
      concernNote: input.intake.concernNote,
      allergyNote: input.intake.allergyNote,
      estimatedPriceKo: priceWon ? formatKRW(priceWon) : undefined,
    });

    await repo.setSummary(consultation.id, summary);
    await repo.updateStatus(consultation.id, "consulting");

    // 디자이너 웹푸시 알림 — notifyDesigner 는 throw 하지 않으므로 await 해도 안전.
    if (designerId) {
      // 디자이너 QR 직접 배정 → 그 디자이너에게 새 손님 알림(요약 화면으로).
      await notifyDesigner(
        designerId,
        {
          title: "새 손님 접수",
          body: summary.headline ?? "새 상담",
          url: designerSummaryPath(consultation.designerToken),
        },
        { salonSlug, consultationId: consultation.id, kind: "new_consultation" },
      );
    } else {
      // 살롱 공용(미배정) — 단골 자동 라우팅을 우선 시도한다(best-effort).
      const designers = await repo.listDesigners(salonSlug);

      // 우선 디자이너 결정: ① 재방문이면 지난 담당(active 한정, 4.6 에서 포착) ② 살롱 디자이너 1명이면 그 1명.
      let preferred: Designer | undefined;
      if (priorDesignerId) {
        preferred = designers.find((d) => d.id === priorDesignerId);
      }
      if (!preferred && designers.length === 1) {
        preferred = designers[0];
      }

      if (preferred) {
        // 단골/단일 디자이너 → 선 배정(best-effort) 후 그 디자이너에게만 알림(요약 화면으로).
        try {
          await repo.assignConsultation(consultation.id, {
            id: preferred.id,
            name: preferred.name,
          });
        } catch (e) {
          await logIssue({
            salonSlug,
            severity: "warning",
            source: "intake",
            message: "단골 자동 배정 실패(알림은 진행)",
            detail: e instanceof Error ? e.message : String(e),
            consultationId: consultation.id,
          });
        }
        await notifyDesigner(
          preferred.id,
          {
            title: isReturning ? "단골 손님 재방문" : "새 손님 접수",
            body: summary.headline ?? "새 상담",
            url: designerSummaryPath(consultation.designerToken),
          },
          { salonSlug, consultationId: consultation.id, kind: "new_consultation" },
        );
      } else {
        // 폴백: 그 살롱 디자이너 전원에게 미배정 손님 알림(인박스로).
        await Promise.all(
          designers.map((d) =>
            notifyDesigner(
              d.id,
              {
                title: "새 미배정 손님",
                body: summary.headline ?? "",
                url: designerInboxPath(d.staffToken),
              },
              {
                salonSlug,
                consultationId: consultation.id,
                kind: "new_consultation",
              },
            ),
          ),
        );
      }
    }

    return {
      consultationToken: consultation.consultationToken,
      consultationId: consultation.id,
    };
  } catch (e) {
    await logIssue({
      salonSlug,
      source: "intake",
      message: "상담 생성/요약 실패",
      detail: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

/* ── 살롱 공개 정보 (C1 진입 화면용) ───────────────────── */
export async function getSalonInfo(slug: string): Promise<Salon | null> {
  return getRepo().getSalon(slug);
}

/**
 * C1 진입: 입장 토큰을 검증한 뒤에만 살롱 공개 정보를 돌려준다(평문 slug 비노출).
 * 디자이너 토큰이면 designer 도 함께 반환(C1 에 디자이너명 표시).
 * 무효/폐기 토큰이면 { salon: null }.
 */
export async function getSalonInfoByEntry(
  entryToken: string,
): Promise<{ salon: Salon | null; designer?: Designer }> {
  // 레이트리밋(P0) — 입장 토큰당 분당 C1 조회 상한(토큰 위조 스캔/폭주 방지).
  await enforceRate(`entry:${entryToken}`, 60, 60_000, { source: "C1" });
  const resolved = await resolveEntry(entryToken, "C1");
  if (!resolved) return { salon: null };
  const salon = await getRepo().getSalon(resolved.salonSlug);
  if (!salon) return { salon: null };
  return { salon, designer: resolved.designer };
}

/* ── 손님/디자이너 뷰 ──────────────────────────────────── */
export interface ConsultationView {
  /** 비밀(ownerToken 등) 제거 투영 — 서버컴포넌트 경유라도 살롱 비밀은 싣지 않는다. */
  salon: PublicSalon | null;
  consultation: Consultation;
  messages: Message[];
  /**
   * 인테이크에서 선택한 시술 id(consultation.intake.serviceIds) → 살롱 메뉴 다국어 라벨.
   * 시술중/완료 요약(손님 언어)에서 시술명을 손님 로케일로 표기하는 데 쓴다.
   * 손님 뷰라 best-effort(조회 실패/미스 id 는 키 누락으로 둔다). getDesignerView 패턴 재사용.
   */
  serviceLabelMap: Record<string, LocalizedText>;
}

/** 디자이너 뷰 — 인박스 백버튼 동선을 위해 그 디자이너 staffToken 을 함께 반환(UX). */
export interface DesignerConsultationView extends ConsultationView {
  /** 배정된 디자이너의 staffToken(인박스 링크용). 미배정이면 undefined. */
  staffToken?: string;
  /** 이 상담건의 시술 기록(완료건 EMR 용). 미완료/기록 없으면 undefined. */
  treatmentRecord?: TreatmentRecord;
  /**
   * 손님의 과거 시술 이력(재방문 카르테) — **현재 상담건 제외**, visitedAt desc.
   * customerId 없으면 [].
   */
  customerTreatments: TreatmentRecord[];
  /**
   * 위 treatmentRecord + customerTreatments 에 등장한 serviceId 만의 살롱 메뉴 라벨맵.
   * 카르테 serviceId 는 `${salonSlug}:${catalogId}` 형식이라 전역 카탈로그로 못 푼다.
   * 어드민 카르테(getCustomerHistory)와 동일 패턴.
   */
  serviceLabelMap: Record<string, LocalizedText>;
  /** 살롱 시술 메뉴(id+다국어 라벨) — 기록폼 '실제 시술' 선택지. */
  salonServiceOptions: { id: string; label: LocalizedText }[];
}

export async function getCustomerView(
  consultationToken: string,
): Promise<ConsultationView | null> {
  const repo = getRepo();
  const c = await repo.getByConsultationToken(consultationToken);
  if (!c) return null;
  const salon = await repo.getSalon(c.salonSlug);

  // 인테이크 시술 id → 살롱 메뉴 다국어 라벨(시술중/완료 요약의 손님 언어 표기용).
  // 손님 뷰라 best-effort — 조회 실패 시 빈 맵으로 둔다(요약 표시만 영향, 채팅/리포트 무영향).
  const serviceLabelMap: Record<string, LocalizedText> = {};
  const neededIds = new Set(c.intake.serviceIds);
  if (neededIds.size > 0) {
    try {
      const salonServices = await repo.listServices(c.salonSlug);
      for (const s of salonServices) {
        if (neededIds.has(s.id)) serviceLabelMap[s.id] = s.label;
      }
    } catch (e) {
      await logIssue({
        salonSlug: c.salonSlug,
        severity: "warning",
        source: "customer-view",
        message: "시술 라벨맵 조회 실패(라벨 생략)",
        detail: e instanceof Error ? e.message : String(e),
        consultationId: c.id,
      });
    }
  }

  return {
    salon: salon ? toPublicSalon(salon) : null,
    // 손님 뷰는 phone 미반환(PII, P1-37). intake.phone 도 함께 제거.
    consultation: stripPhone(c),
    // 초기 메시지도 viewer(손님 언어) 번역을 채워 반환 — 번역이 send 경로에서 빠졌으므로
    // SSR 초기 렌더에서 미번역 노출 방지(폴은 초기셋 이후만 가져오므로 여기서 채워야 함).
    messages: await fillViewerTranslations(
      c.id,
      await repo.listMessages(c.id),
      c.customerLocale,
    ),
    serviceLabelMap,
  };
}

/**
 * 손님 채팅 폴링용 경량 상담 상태 — 완료(+리포트 도착) 감지에 쓴다.
 * getCustomerView 가 status/reportToken 을 이미 주지만(전체 Consultation),
 * 폴링이 메시지와 별개로 가볍게 완료/리포트만 확인할 수 있게 별도 노출한다.
 * consultationToken 으로 조회. 없으면 null. (레이트리밋 — 토큰당 분당 상한.)
 */
export async function getConsultationStatus(
  consultationToken: string,
): Promise<{ status: ConsultationStatus; reportToken?: string } | null> {
  // 폴링 레이트리밋(P0) — consultationToken 당 분당 상한(폴 폭주 방지, getMessagesSince 와 동급).
  await enforceRate(`status:${consultationToken}`, 120, 60_000, {
    source: "status",
  });
  const c = await getRepo().getByConsultationToken(consultationToken);
  if (!c) return null;
  return { status: c.status, reportToken: c.reportToken };
}

/** 손님 뷰 PII 제거 — phone / intake.phone 미반환(P1-37). */
function stripPhone(c: Consultation): Consultation {
  return {
    ...c,
    phone: undefined,
    intake: { ...c.intake, phone: undefined },
  };
}

export async function getDesignerView(
  designerToken: string,
): Promise<DesignerConsultationView | null> {
  const repo = getRepo();
  const c = await repo.getByDesignerToken(designerToken);
  if (!c) return null;
  const salon = await repo.getSalon(c.salonSlug);
  // 배정된 디자이너면 인박스 백버튼용 staffToken 을 함께 반환(UX). 미배정이면 생략.
  // 주의: staffToken 은 인박스 접근 비밀이므로 디자이너 인박스 경로 외 클라 노출 금지.
  let staffToken: string | undefined;
  if (c.designerId) {
    const designer = await repo.getDesignerById(c.designerId);
    staffToken = designer?.staffToken;
  }

  // 완료건 EMR 용 — 이 상담건의 시술 기록(있으면). best-effort.
  let treatmentRecord: TreatmentRecord | undefined;
  try {
    treatmentRecord = (await repo.getTreatmentByConsultation(c.id)) ?? undefined;
  } catch (e) {
    await logIssue({
      salonSlug: c.salonSlug,
      severity: "warning",
      source: "designer-view",
      message: "상담 시술 기록 조회 실패(EMR 생략)",
      detail: e instanceof Error ? e.message : String(e),
      consultationId: c.id,
    });
  }

  // 손님 과거 이력 — customerId 있으면 현재 상담건 제외(visitedAt desc 유지). best-effort.
  let customerTreatments: TreatmentRecord[] = [];
  if (c.customerId) {
    try {
      const all = await repo.listCustomerTreatments(c.customerId);
      customerTreatments = all.filter((t) => t.consultationId !== c.id);
    } catch (e) {
      await logIssue({
        salonSlug: c.salonSlug,
        severity: "warning",
        source: "designer-view",
        message: "손님 과거 이력 조회 실패(지난 이력 생략)",
        detail: e instanceof Error ? e.message : String(e),
        consultationId: c.id,
      });
    }
  }

  // 살롱 메뉴 — 카르테 라벨맵 + 기록폼 '실제 시술' 선택지로 사용. best-effort.
  const serviceLabelMap: Record<string, LocalizedText> = {};
  let salonServiceOptions: { id: string; label: LocalizedText }[] = [];
  try {
    const salonServices = await repo.listServices(c.salonSlug);
    salonServiceOptions = salonServices.map((s) => ({ id: s.id, label: s.label }));
    for (const s of salonServices) serviceLabelMap[s.id] = s.label;
  } catch (e) {
    await logIssue({
      salonSlug: c.salonSlug,
      severity: "warning",
      source: "designer-view",
      message: "살롱 시술 메뉴 조회 실패(라벨·선택지 생략)",
      detail: e instanceof Error ? e.message : String(e),
      consultationId: c.id,
    });
  }

  return {
    salon: salon ? toPublicSalon(salon) : null,
    consultation: c,
    // 디자이너 뷰(ko)도 초기 메시지 번역을 채워 반환(SSR 미번역 방지, 위와 동일 이유).
    messages: await fillViewerTranslations(
      c.id,
      await repo.listMessages(c.id),
      "ko",
    ),
    staffToken,
    treatmentRecord,
    customerTreatments,
    serviceLabelMap,
    salonServiceOptions,
  };
}

/* ── 메시지 전송/번역 ───────────────────────────────────
 * 번역은 send 경로에서 동기로 기다리지 않는다(보낸 사람은 자기 원문만 보면 됨).
 * 수신자가 폴(getMessagesSince)할 때, viewer 로케일이 비어있는 메시지만 그때 번역해
 * 캐시(updateMessageTranslations)한다 → "sending" 지연 제거(라이브 latency 버그). */
// 같은 (메시지,대상로케일) 번역이 여러 폴에서 중복 발사되지 않게(인스턴스 내 best-effort).
// 값(Promise)을 공유해 동시 폴이 같은 번역을 재사용한다.
const inFlightTranslate = new Map<string, Promise<string | null>>();

/** 메시지를 to 로케일로 번역(실패 시 null). 동시 호출은 같은 Promise 를 공유. */
async function translateFor(m: Message, to: Locale): Promise<string | null> {
  if (m.sourceLocale === to) return m.sourceText;
  if (m.translations[to] != null) return m.translations[to] ?? null;
  const key = `${m.id}:${to}`;
  let p = inFlightTranslate.get(key);
  if (!p) {
    p = (async () => {
      try {
        return await getAi().translate({
          text: m.sourceText,
          from: m.sourceLocale,
          to,
          domain: "salon",
        });
      } catch {
        return null;
      } finally {
        inFlightTranslate.delete(key);
      }
    })();
    inFlightTranslate.set(key, p);
  }
  return p;
}

/** 백그라운드 번역+캐시 — postMessage 의 선번역(after) 용. 캐시를 데워 폴이 즉답하게. */
async function translateAndCache(
  consultationId: string,
  m: Message,
  to: Locale,
): Promise<void> {
  if (m.sourceLocale === to || m.translations[to] != null) return;
  const translated = await translateFor(m, to);
  if (translated == null) return;
  await getRepo()
    .updateMessageTranslations(consultationId, m.id, {
      ...m.translations,
      [to]: translated,
    })
    .catch(() => {});
}

/**
 * viewer 로케일 번역을 **동기 보장**하고 채운 메시지를 반환(초기로드·폴 공용).
 * 과거엔 after() 로 예약만 하고 미번역 상태로 내려보냈는데, 클라 폴 커서가 그 메시지를
 * 지나쳐 뒤늦은 번역을 영영 못 받는 freeze 버그가 있었다 → 여기서 채워 내려보낸다.
 * 이미 캐시된 메시지는 즉시 통과(추가 지연 없음), 새 메시지만 번역(≤2.5s, mock 폴백)한다.
 */
async function fillViewerTranslations(
  consultationId: string,
  messages: Message[],
  viewer: Locale,
): Promise<Message[]> {
  return Promise.all(
    messages.map(async (m) => {
      if (m.sourceLocale === viewer || m.translations[viewer] != null) return m;
      const translated = await translateFor(m, viewer);
      if (translated == null) return m; // 실패 시 원문 유지(클라가 원문 렌더)
      const translations = { ...m.translations, [viewer]: translated };
      await getRepo()
        .updateMessageTranslations(consultationId, m.id, translations)
        .catch(() => {});
      return { ...m, translations };
    }),
  );
}

export async function postMessage(input: {
  token: string;
  role: "customer" | "designer";
  text?: string;
  intent?: QuickReplyIntent;
  /** 정확히 어떤 퀵리플라이 칩인지 (동일 intent 다수 칩 구분, P1). 없으면 intent 폴백. */
  replyId?: string;
  value?: string;
}): Promise<Message | null> {
  const repo = getRepo();
  const c =
    input.role === "customer"
      ? await repo.getByConsultationToken(input.token)
      : await repo.getByDesignerToken(input.token);
  if (!c) {
    return null;
  }

  // 레이트리밋 — 토큰+역할당 분당 메시지 상한(P0-10)
  await enforceRate(`msg:${input.role}:${input.token}`, 30, 60_000, {
    salonSlug: c.salonSlug,
    source: "translate",
    consultationId: c.id,
  });

  // 시술 시작은 더 이상 첫 디자이너 메시지로 자동 전이하지 않는다(Phase 2).
  // 채팅 중에는 startConsultation 이 둔 consulting 상태가 유지되고,
  // 디자이너가 명시적으로 startService 를 호출할 때만 in_service 로 전이한다.

  try {
    // 디자이너 퀵리플라이 → 사전 번역 사용 (고품질, 번역 호출 없음)
    if (input.role === "designer" && input.intent && input.intent !== "custom") {
      // replyId 로 정확 매칭(동일 intent 다수 칩 구분, P1). 없으면 intent 폴백.
      const qr =
        (input.replyId
          ? QUICK_REPLIES.find((q) => q.replyId === input.replyId)
          : undefined) ?? QUICK_REPLIES.find((q) => q.intent === input.intent);
      if (qr) {
        // price 칩: value=won(number 문자열) → 손님/디자이너 각 로케일 통화 표기.
        // time 칩: value=minutes(number 문자열) → 각 로케일 TIME_PRESETS 라벨.
        const subFor = (locale: Locale, template: string): string => {
          if (!qr.needsValue) return template;
          if (qr.valueKind === "price") {
            const won = Number(input.value);
            const formatted = Number.isFinite(won)
              ? formatPrice(won, locale)
              : (input.value ?? "");
            return template.replace("{value}", formatted);
          }
          if (qr.valueKind === "time") {
            const minutes = Number(input.value);
            const preset = TIME_PRESETS.find((t) => t.minutes === minutes);
            const formatted = preset
              ? (preset.label[locale] ?? preset.label.ko)
              : (input.value ?? "");
            return template.replace("{value}", formatted);
          }
          return template.replace("{value}", input.value ?? "");
        };
        const sourceText = subFor("ko", qr.message.ko);
        const translations: Partial<Record<Locale, string>> = {
          ko: sourceText,
          // zh 등 아직 사전번역이 없는 손님 로케일은 ko 피벗으로 폴백(Phase 3 에서 zh 채움).
          [c.customerLocale]: subFor(
            c.customerLocale,
            qr.message[c.customerLocale] ?? qr.message.ko,
          ),
        };
        const msg = await repo.addMessage({
          consultationId: c.id,
          sender: "designer",
          sourceText,
          sourceLocale: "ko",
          intent: input.intent,
          translations,
        });
        return msg;
      }
    }

    const text = (input.text ?? "").trim();
    if (!text) {
      return null;
    }
    const sourceLocale: Locale = input.role === "customer" ? c.customerLocale : "ko";
    // 원문만 저장하고 즉시 반환 — 번역은 수신자 폴 시점(fillViewerTranslations)에 채운다.
    const msg = await repo.addMessage({
      consultationId: c.id,
      sender: input.role,
      sourceText: text,
      sourceLocale,
      intent: input.intent,
      translations: { [sourceLocale]: text },
    });
    // 상대 로케일 선번역(폴 갭 동안 캐시 완료 유도) — 손님 msg→ko, 디자이너 msg→customerLocale.
    const otherLocale: Locale = input.role === "customer" ? "ko" : c.customerLocale;
    if (msg && msg.sourceLocale !== otherLocale) {
      after(() => translateAndCache(c.id, msg, otherLocale));
    }
    return msg;
  } catch (e) {
    await logIssue({
      salonSlug: c.salonSlug,
      source: "translate",
      message: "메시지 전송/번역 실패",
      detail: e instanceof Error ? e.message : String(e),
      consultationId: c.id,
    });
    throw e;
  }
}

export async function getMessagesSince(input: {
  token: string;
  role: "customer" | "designer";
  sinceIso?: string;
}): Promise<Message[]> {
  const repo = getRepo();
  // 폴링 레이트리밋(P0) — 토큰+역할당 분당 상한. 폴 폭주로 커넥션풀 고갈 방지.
  // 정상 폴 간격(클라 POLL_MS) 대비 넉넉히 두되 폭주는 차단.
  await enforceRate(`poll:${input.role}:${input.token}`, 120, 60_000, {
    source: "poll",
  });
  const c =
    input.role === "customer"
      ? await repo.getByConsultationToken(input.token)
      : await repo.getByDesignerToken(input.token);
  if (!c) return [];
  const msgs = await repo.listMessages(c.id, input.sinceIso);
  // viewer 로케일이 빈 메시지는 여기서 동기 번역해 채워 반환 — 미번역 상태로 내려가면
  // 클라 폴 커서가 지나쳐 freeze 되므로. 캐시된 건 즉시 통과, 새 메시지만 번역.
  const viewer: Locale = input.role === "customer" ? c.customerLocale : "ko";
  return fillViewerTranslations(c.id, msgs, viewer);
}

/* ── 시술 전 사진 저장 (요약 단계 촬영) ─────────────────────────
 * 디자이너가 요약 화면에서 '시술 전' 사진을 찍어 상담건에 붙여둔다.
 * 리포트 발송 시 completeConsultation 이 이 값을 before 로 우선 사용한다.
 * - getByDesignerToken 으로 상담 확정(없으면 {ok:false})
 * - assertValidPhotos 로 dataURL 검증(개수/길이/MIME)
 * - designerToken 당 레이트리밋(거대 dataURL 반복 저장 어뷰즈 차단)
 * throw 대신 {ok} 로 응답(메인 플로우 보호). */
export async function saveBeforePhoto(
  designerToken: string,
  dataUrl: string,
): Promise<{ ok: boolean }> {
  const repo = getRepo();
  const c = await repo.getByDesignerToken(designerToken);
  if (!c) return { ok: false };

  // 레이트리밋(P0) — designerToken 당 분당 비포 사진 저장 상한.
  await enforceRate(`before-photo:${designerToken}`, 12, 60_000, {
    salonSlug: c.salonSlug,
    source: "before-photo",
    consultationId: c.id,
  });

  // 사진 dataURL 검증(P0) — 개수/길이/MIME 화이트리스트. 위반 시 throw → {ok:false}.
  try {
    await assertValidPhotos([dataUrl], {
      salonSlug: c.salonSlug,
      source: "before-photo",
      consultationId: c.id,
    });
    await repo.setBeforePhoto(c.id, dataUrl);
    return { ok: true };
  } catch (e) {
    await logIssue({
      salonSlug: c.salonSlug,
      severity: "warning",
      source: "before-photo",
      message: "시술 전 사진 저장 실패",
      detail: e instanceof Error ? e.message : String(e),
      consultationId: c.id,
    });
    return { ok: false };
  }
}

/* ── 시술 시작(명시) → in_service 전이 ─────────────────────────
 * 디자이너가 요약/스레드에서 명시적으로 '시술 시작'을 누를 때 호출.
 * (첫 디자이너 메시지 자동 전이는 Phase 2 에서 제거 — 채팅 중엔 consulting 유지.)
 * - getByDesignerToken 으로 상담 확정(없으면 {ok:false})
 * - status 가 intake/consulting 이면 in_service 로 전이, 그 외(이미 in_service/completed
 *   /cancelled)는 무시(멱등). designerToken 당 레이트리밋(반복 트리거 어뷰즈 차단). */
export async function startService(
  designerToken: string,
): Promise<{ ok: boolean }> {
  const repo = getRepo();
  const c = await repo.getByDesignerToken(designerToken);
  if (!c) return { ok: false };

  // 레이트리밋(P0) — designerToken 당 분당 시술 시작 시도 상한.
  await enforceRate(`start-service:${designerToken}`, 12, 60_000, {
    salonSlug: c.salonSlug,
    source: "start-service",
    consultationId: c.id,
  });

  // intake/consulting 에서만 전이. 그 외 상태는 멱등하게 무시(ok:true).
  if (c.status === "intake" || c.status === "consulting") {
    await repo.updateStatus(c.id, "in_service");
  }
  return { ok: true };
}

/**
 * 디자이너 신체정보 입력(요약 화면 '디자이너 입력' 카드) — designerToken 권한.
 * 손님 인테이크에서 옮겨온 항목(얼굴형·볼륨·머리숱·모질·가마·성별) + 알레르기 재확인을
 * consultation.designer_input 에 저장. 완료 시 카르테·학습에 input_by="designer" 로 반영.
 */
export async function recordDesignerIntake(
  designerToken: string,
  input: DesignerHairInput,
): Promise<{ ok: boolean }> {
  const repo = getRepo();
  const c = await repo.getByDesignerToken(designerToken);
  if (!c) return { ok: false };
  // 레이트리밋(P0) — designerToken당 분당 디자이너 입력 저장 상한(스팸 방지).
  await enforceRate(`designer-intake:${designerToken}`, 12, 60_000, {
    salonSlug: c.salonSlug,
    source: "designer-intake",
    consultationId: c.id,
  });
  await repo.setDesignerInput(c.id, input);
  return { ok: true };
}

/* ── 시술 완료 → 리포트 발송 ───────────────────────────── */
export async function completeConsultation(input: {
  designerToken: string;
  record?: {
    products: string[];
    stateGrade?: ThreeLevel;
    /** 실제 캡처한 만족도/결과 점수(AI 추론값 아님) — 카르테에 영속. */
    satisfactionScore?: number;
    /** 디자이너가 실제로 한 시술(살롱 메뉴 id). 미입력 시 손님 분류로 폴백(태그 구분). */
    serviceIds?: string[];
  };
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}): Promise<{ reportToken: string; designerReportToken: string } | null> {
  const repo = getRepo();
  const c = await repo.getByDesignerToken(input.designerToken);
  if (!c || !c.summary) return null;

  // 레이트리밋(P0) — designerToken 당 분당 완료/리포트 시도 상한.
  // 반복 호출로 Gemini draftReport 과금/커넥션 폭주를 막는다.
  await enforceRate(`complete:${input.designerToken}`, 6, 60_000, {
    salonSlug: c.salonSlug,
    source: "report",
    consultationId: c.id,
  });

  // 사진 dataURL 검증(P0) — before/after 각각 개수/길이/MIME 화이트리스트.
  await assertValidPhotos(
    [input.beforePhotoUrl, input.afterPhotoUrl].filter(
      (u): u is string => typeof u === "string",
    ),
    { salonSlug: c.salonSlug, source: "report", consultationId: c.id },
  );

  // 상태 전이 가드(P1): in_service / consulting 에서만 완료로 진행.
  if (c.status !== "in_service" && c.status !== "consulting") {
    await logIssue({
      salonSlug: c.salonSlug,
      severity: "warning",
      source: "report",
      message: `완료 불가 상태에서 리포트 시도 (status=${c.status})`,
      consultationId: c.id,
    });
    return null;
  }

  // 원자 클레임(M-K) — 동시 이중완결 레이스에서 승자 1건만 body 실행(중복 카르테/샘플 방지).
  // 여기서 status→completed 로 선점하고, 리포트 저장 전 실패 시 아래 catch 가 원 상태로 복원.
  const prevStatus = c.status;
  const claimed = await repo.claimConsultationForCompletion(c.id);
  if (!claimed) return null;

  // before 소스 결정: 기록폼이 보낸 값(요약 단계 촬영분으로 프리필되며 교체 가능)을 우선,
  // 없으면 상담에 저장된 beforePhotoUrl 폴백. after 는 그대로 input.
  const beforeUrl = input.beforePhotoUrl ?? c.beforePhotoUrl;

  // 사진은 선택(필수 아님) — 디자이너가 바쁘면 사진 없이도 완결 가능(수집률 우선, §12.2 H3).
  // 단, 사진 유무는 데이터로 기록(H4 촬영습관 측정)하여 파일럿에서 감시한다(아래 has_*_photo).
  const hasBeforePhoto = !!beforeUrl;
  const hasAfterPhoto = !!input.afterPhotoUrl;

  try {
    const salon = await repo.getSalon(c.salonSlug);
    const ai = getAi();
    const threadMessages = await repo.listMessages(c.id);
    // 리포트 시술 서술의 권위 소스 — 디자이너가 실제 기록한 serviceIds 를 ko 라벨로.
    // 미기록이면 undefined → 프롬프트가 summary.services(손님 인테이크 희망)로 폴백(S2/F1).
    const reportServiceIds = input.record?.serviceIds ?? [];
    const salonServicesForLabels = reportServiceIds.length
      ? await repo.listServices(c.salonSlug)
      : [];
    const actualServiceLabelsKo = reportServiceIds.length
      ? reportServiceIds
          .map((id) => salonServicesForLabels.find((s) => s.id === id)?.label.ko)
          .filter((x): x is string => !!x)
      : undefined;
    const draft = await ai.draftReport({
      customerLocale: c.customerLocale,
      summary: c.summary,
      threadHighlightsKo: threadMessages
        .map((m) => m.translations.ko ?? m.sourceText)
        .slice(-8),
      actualServiceLabelsKo,
      record: input.record,
    });

    // 제품은 **카탈로그에서 확정**(LLM 발명 차단, S2/F2) — 디자이너 기록 제품 id → 손님 로케일 라벨.
    // 기록 없으면 빈 배열(없는 제품 추천 금지). draft.products(모델 생성)는 쓰지 않는다.
    const localizedProducts = localizeProducts(
      input.record?.products ?? [],
      c.customerLocale,
    );
    // 모발 상태 등급/점수는 **디자이너 입력에서 결정론적**으로(LLM 조작 차단, S2/F3).
    // 미기록이면 stateEstimated=true 로 표시(리포트가 "측정값"으로 단정하지 않게).
    const designerGrade = input.record?.stateGrade;
    const stateEstimated = designerGrade == null;
    const finalGrade = designerGrade ?? "mid";
    const finalScore = scoreFromGrade(finalGrade);

    // 리포트 보강(신규 optional) — 손님 요청 스타일/고민/주의는 요약(ko)에서, 없으면 인테이크 폴백.
    // 빈 문자열은 넣지 않는다(undefined 유지 → 리포트에서 해당 섹션 미노출).
    // 이 값들은 모두 한국어(요약/인테이크 메모)이므로, 손님 리포트에는 손님 언어로 번역해 싣는다.
    const styleRequestKo =
      c.summary.styleDetail?.trim() || c.intake.styleNote?.trim() || undefined;
    const concernsKo =
      c.summary.concerns?.trim() || c.intake.concernNote?.trim() || undefined;
    const cautionsKo = c.summary.hairCautions?.trim() || undefined;

    // ko 본문을 손님 언어로 번역(손님 리포트용). customerLocale==="ko" 면 그대로.
    // 번역 실패는 ko 원문으로 폴백(리포트 발송 보장) — translateToCustomer 가 try/catch.
    const translateToCustomer = async (
      koText: string | undefined,
    ): Promise<string | undefined> => {
      if (!koText) return undefined;
      if (c.customerLocale === "ko") return koText;
      try {
        return await ai.translate({
          text: koText,
          from: "ko",
          to: c.customerLocale,
          domain: "salon",
        });
      } catch (e) {
        await logIssue({
          salonSlug: c.salonSlug,
          severity: "warning",
          source: "report",
          message: "리포트 보강 텍스트 번역 실패(ko 원문 폴백)",
          detail: e instanceof Error ? e.message : String(e),
          consultationId: c.id,
        });
        return koText;
      }
    };

    const [styleRequest, concerns, cautions] = await Promise.all([
      translateToCustomer(styleRequestKo),
      translateToCustomer(concernsKo),
      translateToCustomer(cautionsKo),
    ]);

    const reportToken = c.reportToken ?? cryptoToken();
    // 디자이너용(ko) 리포트 토큰 — 기본은 손님 토큰(ko 손님이거나 ko 생성 실패 시 폴백),
    // 비-ko 손님이면 아래에서 koToken 으로 교체. record-form 발송 후 링크가 ko 리포트를 가리키게.
    let designerReportToken = reportToken;
    const report: HairReport = {
      ...draft,
      products: localizedProducts,
      // 등급/점수는 디자이너 입력 기반 결정론값으로 override(모델 값 무시).
      hairStateGrade: finalGrade,
      hairStateScore: finalScore,
      stateEstimated,
      styleRequest,
      concerns,
      cautions,
      consultationId: c.id,
      reportToken,
      salonName: salon?.name ?? "소통 헤어",
      salonSlug: c.salonSlug,
      designerName: c.designerName ?? "담당 디자이너",
      date: new Date().toISOString(),
      beforePhotoUrl: beforeUrl,
      afterPhotoUrl: input.afterPhotoUrl,
      locale: c.customerLocale,
    };

    await repo.saveReport(report);
    await repo.setReportToken(c.id, reportToken);
    // status 는 위 claimConsultationForCompletion 에서 이미 completed 로 전이됨.

    // ── 디자이너용 ko 리포트 ───────────────────────────────────────
    // 손님 언어가 ko 가 아니면 별도 ko 리포트를 추가 생성·저장하고 designerReportToken 을 둔다.
    // (손님이 한국인이면 손님 리포트가 곧 ko 리포트 — designerReportToken=reportToken 으로 공유.)
    // ko 리포트 생성/저장 실패는 try/catch+logIssue — 이미 발송된 손님 리포트를 절대 망치지 않는다.
    if (c.customerLocale === "ko") {
      try {
        await repo.setDesignerReportToken(c.id, reportToken);
      } catch (e) {
        await logIssue({
          salonSlug: c.salonSlug,
          severity: "warning",
          source: "report",
          message: "디자이너 리포트 토큰(=손님 ko 토큰) 저장 실패",
          detail: e instanceof Error ? e.message : String(e),
          consultationId: c.id,
        });
      }
    } else {
      try {
        const koDraft = await ai.draftReport({
          customerLocale: "ko",
          summary: c.summary,
          threadHighlightsKo: threadMessages
            .map((m) => m.translations.ko ?? m.sourceText)
            .slice(-8),
          actualServiceLabelsKo,
          record: input.record,
        });
        const koToken = cryptoToken();
        const koReport: HairReport = {
          ...koDraft,
          // 제품은 손님 리포트와 동일하게 카탈로그 확정(ko 라벨), 모델 값 무시.
          products: localizeProducts(input.record?.products ?? [], "ko"),
          // ko 리포트는 요약(ko) 원문 그대로(번역 불필요).
          styleRequest: styleRequestKo,
          concerns: concernsKo,
          cautions: cautionsKo,
          consultationId: c.id,
          reportToken: koToken,
          salonName: salon?.name ?? "소통 헤어",
          salonSlug: c.salonSlug,
          designerName: c.designerName ?? "담당 디자이너",
          // before/after/점수/등급/다음 방문은 손님 리포트와 공유(같은 시술 결과).
          hairStateGrade: report.hairStateGrade,
          hairStateScore: report.hairStateScore,
          stateEstimated: report.stateEstimated,
          nextVisitWeeks: report.nextVisitWeeks,
          date: report.date,
          beforePhotoUrl: beforeUrl,
          afterPhotoUrl: input.afterPhotoUrl,
          locale: "ko",
        };
        await repo.saveReport(koReport);
        await repo.setDesignerReportToken(c.id, koToken);
        designerReportToken = koToken;
      } catch (e) {
        await logIssue({
          salonSlug: c.salonSlug,
          severity: "warning",
          source: "report",
          message: "디자이너 ko 리포트 생성/저장 실패(손님 리포트는 발송됨)",
          detail: e instanceof Error ? e.message : String(e),
          consultationId: c.id,
        });
      }
    }

    // ── 데이터 출처(provenance) 병합 (항목 5) ─────────────────────
    // 신체정보: 디자이너 입력(요약 카드) 우선, 없으면 레거시 손님값. 출처로 input_by 결정.
    const di = c.designerInput;
    const hasDesignerBody = !!(
      di &&
      (di.faceShape || di.crownVolume || di.hairDensity || di.hairType || di.gender)
    );
    const hasLegacyBody = !!(
      c.intake.faceShape ||
      c.intake.crownVolume ||
      c.intake.hairDensity ||
      c.intake.hairType ||
      c.intake.gender
    );
    const faceShape = di?.faceShape ?? c.intake.faceShape;
    const crownVolume = di?.crownVolume ?? c.intake.crownVolume;
    const hairDensity = di?.hairDensity ?? c.intake.hairDensity;
    const hairType = di?.hairType ?? c.intake.hairType;
    const gender = di?.gender ?? c.intake.gender;
    const bodyInputBy: "customer" | "designer" | undefined = hasDesignerBody
      ? "designer"
      : hasLegacyBody
        ? "customer"
        : undefined;
    // 시술: 디자이너 실제기록 우선(실제 한 것) / 미기록 시 손님 분류 폴백(희망, 실제 아님 — 태그 구분).
    const actualServiceIds = input.record?.serviceIds ?? [];
    const recordServiceIds = actualServiceIds.length
      ? actualServiceIds
      : (c.intake.serviceCategoryIds ?? []);
    const servicesInputBy: "customer" | "designer" = actualServiceIds.length
      ? "designer"
      : "customer";

    // 카르테(treatment_record) 영속 — 방문 1건을 customer 밑에 누적.
    // best-effort: 실패해도 이미 발송된 리포트를 망치지 않는다(try/catch + logIssue).
    try {
      await repo.createTreatmentRecord({
        consultationId: c.id,
        customerId: c.customerId,
        salonSlug: c.salonSlug,
        designerId: c.designerId,
        designerName: c.designerName,
        serviceIds: recordServiceIds,
        products: input.record?.products ?? [],
        stateGrade: input.record?.stateGrade,
        satisfactionScore: input.record?.satisfactionScore,
        note: undefined,
        faceShape,
        crownVolume,
        hairDensity,
        hairType,
        gender,
        inputBy: bodyInputBy,
        servicesInputBy,
        allergyConfirmedByDesigner: di?.allergyConfirmedByDesigner,
        hasBeforePhoto,
        hasAfterPhoto,
      });
    } catch (e) {
      await logIssue({
        salonSlug: c.salonSlug,
        severity: "warning",
        source: "report",
        message: "시술 기록(카르테) 영속 실패",
        detail: e instanceof Error ? e.message : String(e),
        consultationId: c.id,
      });
    }

    // ── 비식별 ML 학습 샘플 적재(학습 옵트인 동의 건만) ──────────
    // 원본 상담은 retention 으로 90일 후 파기되지만, 이 가명·통계 샘플은 자산으로 남는다.
    // 사진·전화·이름·자유텍스트·얼굴은 제외. best-effort(실패해도 리포트 무손상).
    if (c.intake.trainingConsentedAt || c.intake.photoTrainingConsentedAt) {
      // 가명 — 샘플·사진이 같은 방문으로 연결되도록 한 번만 계산.
      const pseudonym = c.customerId
        ? pseudonymize(c.customerId)
        : `anon-${cryptoToken()}`;
      // 데이터 학습 샘플은 **데이터 학습 동의**가 있을 때만 — 사진-only 동의로는 생성 금지
      // (동의 세분성, S2/F4). 아래 사진 블록은 photoTrainingConsentedAt 로 별도 게이트.
      if (c.intake.trainingConsentedAt)
        try {
          const sample: TrainingSample = {
          id: cryptoToken(),
          salonSlug: c.salonSlug,
          customerPseudonym: pseudonym,
          visitedAt: report.date,
          nationality: c.customerLocale,
          gender,
          ageBand: ageBand(c.intake.age),
          faceShape,
          crownVolume,
          hairDensity,
          hairType,
          concernIds: c.intake.concernIds ?? [],
          allergy: !!c.intake.allergy,
          serviceIds: recordServiceIds,
          // 카탈로그 id 만(모델 생성 라벨 폴백 제거 — 데이터셋 오염 방지, F10).
          products: input.record?.products ?? [],
          stateGrade: input.record?.stateGrade ?? report.hairStateGrade,
          hairStateScore: report.hairStateScore,
          satisfactionScore: input.record?.satisfactionScore,
          nextVisitWeeks: report.nextVisitWeeks,
          createdAt: new Date().toISOString(),
          inputBy: bodyInputBy,
          servicesInputBy,
          designerId: c.designerId,
          // H4 촬영습관 측정 — training_sample 은 retention 퍼지 후에도 남는 자산이므로
          // 반드시 사진 유무를 같이 보존(카르테에만 두면 90일 뒤 측정 불가).
          hasBeforePhoto,
          hasAfterPhoto,
          // 손님 별점이 완결 후 도착하면 이 id 로 샘플을 찾아 satisfactionScore 갱신(퍼지 시 NULL).
          consultationId: c.id,
        };
        await repo.saveTrainingSample(sample);
      } catch (e) {
        await logIssue({
          salonSlug: c.salonSlug,
          severity: "warning",
          source: "report",
          message: "학습 샘플 적재 실패",
          detail: e instanceof Error ? e.message : String(e),
          consultationId: c.id,
        });
      }

      // 사진 학습(별도 옵트인) — 비포/애프터/스타일만. 셀카/얼굴 제외(생체정보).
      // dataURL 을 Storage 비공개 버킷에 가명 경로로 적재(training_photos).
      if (c.intake.photoTrainingConsentedAt) {
        try {
          const photos: {
            kind: "before" | "after" | "style";
            dataUrl: string;
          }[] = [];
          for (const url of c.intake.stylePhotoUrls ?? [])
            photos.push({ kind: "style", dataUrl: url });
          // 리포트·hasBeforePhoto 플래그와 같은 소스(beforeUrl)로 — 디자이너가 기록폼에서
          // 새 before 를 올린 경우 stale 한 c.beforePhotoUrl 이 저장되던 불일치 수정(F7).
          if (beforeUrl) photos.push({ kind: "before", dataUrl: beforeUrl });
          if (report.afterPhotoUrl)
            photos.push({ kind: "after", dataUrl: report.afterPhotoUrl });
          if (photos.length > 0) {
            await repo.saveTrainingPhotos({
              customerPseudonym: pseudonym,
              salonSlug: c.salonSlug,
              visitedAt: report.date,
              photos,
            });
          }
        } catch (e) {
          await logIssue({
            salonSlug: c.salonSlug,
            severity: "warning",
            source: "report",
            message: "학습 사진 적재 실패",
            detail: e instanceof Error ? e.message : String(e),
            consultationId: c.id,
          });
        }
      }
    }

    return { reportToken, designerReportToken };
  } catch (e) {
    // 리포트 저장 전 실패 — 클레임으로 선점한 completed 상태를 원복해 재시도 가능케 한다.
    // (saveReport 이후 단계는 모두 개별 try/catch 라 여기 도달 = 리포트 미완성.)
    await repo.updateStatus(c.id, prevStatus).catch(() => {});
    await logIssue({
      salonSlug: c.salonSlug,
      source: "report",
      message: "리포트 생성 실패",
      detail: e instanceof Error ? e.message : String(e),
      consultationId: c.id,
    });
    throw e;
  }
}

export interface ReportViewData {
  report: HairReport;
  /** 손님 실제 언어(ko 리포트여도 손님 국적 표기는 이 언어 기준). */
  customerLocale: Locale;
  gender?: "female" | "male" | "other";
  age?: number;
  /** 손님 총 방문 횟수(카르테, 이번 시술 포함). 신규/미연결이면 0. */
  visitCount: number;
  /** 가장 최근 방문일(ISO). 없으면 undefined. */
  lastVisitDate?: string;
  /** 헤어/얼굴형 DNA 시각화용 — 디자이너 입력 우선, 없으면 손님 인테이크. 없으면 미표시. */
  hair?: {
    faceShape?: FaceShape;
    crownVolume?: ThreeLevel;
    hairDensity?: ThreeLevel;
    hairType?: HairType;
  };
  /** 손님이 남긴 만족도(1~5). 디자이너 읽기전용 뷰에서 결과 표시용. 미평가면 undefined. */
  satisfactionScore?: number;
  /** 리포트 소속 살롱(유입 트래킹 귀속용). */
  salonSlug?: string;
}

export async function getReportView(
  reportToken: string,
): Promise<ReportViewData | null> {
  // 레이트리밋(P0) — 리포트 토큰당 분당 조회 상한(capability URL 스캔/폭주 방지).
  await enforceRate(`report:${reportToken}`, 60, 60_000, { source: "report" });
  const repo = getRepo();
  const report = await repo.getReport(reportToken);
  if (!report) return null;

  // 프로필(성별·나이·국적)·방문이력 — 리포트 본문과 무관한 보강이라 best-effort.
  let customerLocale: Locale = report.locale;
  let gender: "female" | "male" | "other" | undefined;
  let age: number | undefined;
  let visitCount = 0;
  let lastVisitDate: string | undefined;
  let hair: ReportViewData["hair"];
  let satisfactionScore: number | undefined;
  let salonSlug: string | undefined;
  try {
    const tr = await repo.getTreatmentByConsultation(report.consultationId);
    satisfactionScore = tr?.satisfactionScore;
  } catch {
    // 만족도 조회 실패는 프로필/리포트 표시에 영향 없음(별도 격리).
  }
  try {
    const c = await repo.getConsultationById(report.consultationId);
    if (c) {
      customerLocale = c.customerLocale;
      gender = c.intake.gender;
      age = c.intake.age;
      salonSlug = c.salonSlug;
      // DNA 시각화: 디자이너 전문 판단 우선, 없으면 손님 인테이크.
      const b = c.designerInput ?? c.intake;
      hair = {
        faceShape: b?.faceShape,
        crownVolume: b?.crownVolume,
        hairDensity: b?.hairDensity,
        hairType: b?.hairType,
      };
      if (c.customerId) {
        const treatments = await repo.listCustomerTreatments(c.customerId);
        visitCount = treatments.length;
        lastVisitDate = treatments.reduce<string | undefined>(
          (acc, tr) => (!acc || tr.visitedAt > acc ? tr.visitedAt : acc),
          undefined,
        );
      }
    }
  } catch {
    // 프로필/방문이력 조회 실패는 리포트 표시에 영향 없음
  }

  return {
    report,
    customerLocale,
    gender,
    age,
    visitCount,
    lastVisitDate,
    hair,
    satisfactionScore,
    salonSlug,
  };
}

/**
 * 손님 별점(만족도) 저장 — 공개 리포트 토큰에서 호출. 1~5 정수.
 * treatment_record(EMR) + training_sample(학습 정답) 둘 다 갱신.
 * 만족도는 디자이너 추정이 아니라 손님 자기보고(출처=customer).
 */
export async function saveSatisfactionRating(
  reportToken: string,
  score: number,
): Promise<{ ok: boolean }> {
  if (!Number.isInteger(score) || score < 1 || score > 5) return { ok: false };
  const repo = getRepo();
  const report = await repo.getReport(reportToken);
  if (!report) return { ok: false };
  // 레이트리밋(P0) — 공개 토큰 어뷰즈 방지.
  await enforceRate(`rating:${reportToken}`, 10, 60_000, {
    salonSlug: report.salonName,
    source: "report",
    consultationId: report.consultationId,
  });
  // EMR(treatment_record)이 1차 기록 — 실패 시에만 손님에게 {ok:false}.
  try {
    const tr = await repo.getTreatmentByConsultation(report.consultationId);
    if (tr) {
      await repo.updateTreatmentRecord(tr.id, { satisfactionScore: score });
    }
  } catch (e) {
    await logIssue({
      salonSlug: report.salonName,
      severity: "warning",
      source: "report",
      message: "손님 별점 저장 실패",
      detail: e instanceof Error ? e.message : String(e),
      consultationId: report.consultationId,
    });
    return { ok: false };
  }
  // 학습 샘플 반영은 best-effort — 실패해도 EMR 은 저장됐으니 성공으로 응답(별점 리셋 방지).
  try {
    await repo.updateTrainingSampleSatisfaction(report.consultationId, score);
  } catch (e) {
    await logIssue({
      salonSlug: report.salonName,
      severity: "warning",
      source: "report",
      message: "학습샘플 만족도 갱신 실패(EMR은 저장됨)",
      detail: e instanceof Error ? e.message : String(e),
      consultationId: report.consultationId,
    });
  }
  return { ok: true };
}

/* ── 재방문 프리필 컨텍스트 (인테이크 진입 — 읽기 전용) ──────────
 * resolveEntry 로 살롱 확정 → 쿠키 기기 토큰 읽기 → 매칭 customer 가 있으면
 * 지난 모발 프로필 + 마지막 시술의 serviceIds/날짜를 "지난번처럼" 프리필 소스로 돌려준다.
 * 쿠키를 set 하지 않으므로 서버컴포넌트에서 호출 가능(발급은 startConsultation 이 전담).
 * 무효 토큰/미식별이면 { isReturning: false }, resolveEntry 실패면 null. */
export async function getReturningContext(entryToken: string): Promise<{
  isReturning: boolean;
  profile?: CustomerHairProfile;
  lastServiceIds?: string[];
  lastVisitedAt?: string;
} | null> {
  const repo = getRepo();
  // 레이트리밋(P0) — 입장토큰당 분당 상한(재방문 프로필 열거/폭주 방지).
  await enforceRate(`returning:${entryToken}`, 60, 60_000, {
    source: "returning-context",
  });
  const resolved = await resolveEntry(entryToken, "returning-context");
  if (!resolved) return null;

  const deviceToken = await readDeviceToken();
  if (!deviceToken) return { isReturning: false };

  const customer = await repo.getCustomerByDeviceToken(
    resolved.salonSlug,
    deviceToken,
  );
  if (!customer) return { isReturning: false };

  const [profile, treatments] = await Promise.all([
    repo.getCustomerHairProfile(customer.id),
    repo.listCustomerTreatments(customer.id),
  ]);
  const last = treatments[0]; // visitedAt desc → 첫 항목이 최신

  return {
    isReturning: true,
    profile: profile ?? undefined,
    lastServiceIds: last?.serviceIds,
    lastVisitedAt: last?.visitedAt,
  };
}

/* ── 사장 회원 이력 뷰 (ownerToken 게이트) ──────────────────────
 * 콘솔 권한(ownerToken)으로 살롱을 확정한 뒤, 그 살롱 소속 customer 의
 * 시술 이력(카르테 타임라인)을 돌려준다. 살롱 스코프를 강제(타 살롱 customer 거부).
 * 무효 토큰/타 살롱 customer 면 null. */
export async function getCustomerHistory(
  ownerToken: string,
  customerId: string,
): Promise<{
  customer: Customer;
  treatments: TreatmentRecord[];
  /** 살롱 메뉴 id → 다국어 라벨(카르테의 살롱-프리픽스 serviceId 를 콘솔 로케일로 표기) */
  serviceLabels: Record<string, LocalizedText>;
} | null> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return null;
  const repo = getRepo();

  // customer 가 이 살롱 소속인지 확인(타 살롱 이력 격리). customer 직접 조회 메서드가
  // 없으므로 그 살롱 시술 기록에서 customerId 일치 + salonSlug 일치를 검증한다.
  const treatments = await repo.listCustomerTreatments(customerId);
  const scoped = treatments.filter((t) => t.salonSlug === salon.slug);
  // 이 살롱에서 이 customer 의 흔적이 전혀 없으면(=타 살롱/없음) 노출하지 않는다.
  if (scoped.length === 0) {
    await logIssue({
      salonSlug: salon.slug,
      severity: "warning",
      source: "console",
      message: "회원 이력 조회 대상 불일치(타 살롱/없음)",
      detail: `customerId=${customerId}`,
    });
    return null;
  }

  // customer 메타는 마지막 상담에서 최소 투영으로 구성(전용 getCustomer 메서드 부재).
  const last = await repo.getLastConsultationForCustomer(customerId);
  const customer: Customer = {
    id: customerId,
    salonSlug: salon.slug,
    contactOptOut: false,
    locale: last?.customerLocale ?? "ko",
    isReturning: true,
    createdAt: scoped[scoped.length - 1]?.visitedAt ?? new Date().toISOString(),
  };

  // 살롱 메뉴 라벨맵 — 카르테 serviceId 는 `${salonSlug}:${catalogId}` 형식이라
  // 전역 카탈로그로는 못 푼다. 살롱 서비스에서 id→다국어 라벨을 만들어 내려준다.
  // 실제 카르테에 등장한 serviceId 만 추려 클라 props 를 가볍게 유지.
  const neededIds = new Set(scoped.flatMap((tr) => tr.serviceIds));
  const salonServices = await repo.listServices(salon.slug);
  const serviceLabels: Record<string, LocalizedText> = {};
  for (const s of salonServices) {
    if (neededIds.has(s.id)) serviceLabels[s.id] = s.label;
  }

  return { customer, treatments: scoped, serviceLabels };
}

/** 손님 대면 가격(formatPrice) 헬퍼 — FE 가 손님 로케일로 표기할 때 사용. */
export function customerPrice(won: number, locale: Locale): string {
  return formatPrice(won, locale);
}

const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

/** 모발 상태 등급 → 결정론적 점수(LLM 조작 대신). 등급-점수 일관성 보장. */
function scoreFromGrade(grade: ThreeLevel): number {
  return grade === "high" ? 88 : grade === "low" ? 45 : 68;
}

/** 디자이너 기록 product(카탈로그 id 또는 자유 문자열)를 손님 로케일 라벨로. */
function localizeProducts(products: string[], locale: Locale): string[] {
  return products.map((p) => {
    const item = PRODUCT_MAP.get(p);
    return item ? (item.label[locale] ?? item.label.ko) : p;
  });
}

/** 무인증 토큰 — 절단 없이 192bit 랜덤(base64url). 다른 토큰과 엔트로피 통일(스캔/열거 차단). */
function cryptoToken(): string {
  return randomBytes(24).toString("base64url");
}

/** 가명 — customerId 의 비가역 해시(entrySecret salt). 재방문 연결만, 재식별 불가. */
function pseudonymize(customerId: string): string {
  return createHash("sha256")
    .update(`${customerId}:${config.entrySecret}`)
    .digest("hex")
    .slice(0, 32);
}

/* ── 어드민 / 디자이너 인박스 투영 ─────────────────────────── */

/** 전화번호 뒤 4자리만 노출(어드민, P0/P1-37). 그 외는 undefined. */
function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return `••••${digits.slice(-4)}`;
}

/** Consultation → 어드민/인박스 경량 투영(사진 dataURL·원본 PII 제외, P1-32). */
function toListItem(c: Consultation): ConsultationListItem {
  // 살롱별 시술명은 비동기 조회가 필요하므로, 동기 폴백에서는 시술 개수만 표기.
  // 정상 경로는 summary.headline 이 항상 채워져 있어 이 폴백은 거의 쓰이지 않는다.
  const fallbackHeadline =
    `${NATIONALITY_BY_LOCALE[c.customerLocale]} ${c.isReturning ? "재방문" : "신규"}` +
    (c.intake.serviceIds.length
      ? ` · 시술 ${c.intake.serviceIds.length}건`
      : "");
  return {
    id: c.id,
    salonSlug: c.salonSlug,
    createdAt: c.createdAt,
    status: c.status,
    customerLocale: c.customerLocale,
    nationality: c.summary?.nationality ?? NATIONALITY_BY_LOCALE[c.customerLocale],
    isReturning: c.isReturning,
    headline: c.summary?.headline ?? fallbackHeadline,
    maskedPhone: maskPhone(c.phone),
    designerToken: c.designerToken,
    hasReport: Boolean(c.reportToken),
    designerId: c.designerId,
    designerName: c.designerName,
    customerId: c.customerId,
  };
}

export interface AdminViewData {
  salons: AdminSalon[];
  consultations: ConsultationListItem[];
  errors: ErrorLog[];
}

/**
 * 어드민 데이터(인증 필수, P0).
 * - 세션 쿠키 검증 실패 → throw (무인증 전 지점 PII 노출 차단)
 * - salons → AdminSalon[] (entryToken/entryPath 서버 계산)
 * - consultations → ConsultationListItem[] (헤드라인/마스킹 폰/사진·PII 제외)
 */
export async function getAdminData(
  salonSlug?: string,
): Promise<AdminViewData> {
  await ensureAdminSession(salonSlug);
  const repo = getRepo();
  const [salons, consultations, errors] = await Promise.all([
    repo.listSalons(),
    repo.listConsultations({ salonSlug, limit: 100 }),
    repo.listErrors({ salonSlug, limit: 100 }),
  ]);

  // 각 살롱: 공용 QR + 디자이너별 QR(라벨/경로/담당건수)
  const adminSalons: AdminSalon[] = await Promise.all(
    salons.map(async (s) => {
      const salonEntryToken = makeSalonEntryToken(s.slug, s.entryKeyVersion);
      const designers = await repo.listDesigners(s.slug);
      const designerCounts = await Promise.all(
        designers.map(async (d) => {
          const mine = await repo.listConsultations({ designerId: d.id });
          const entryToken = makeDesignerEntryToken(d.id, d.entryKeyVersion);
          const adminDesigner: AdminDesigner = {
            ...d,
            entryToken,
            entryPath: customerEntryPath(entryToken),
            consultationCount: mine.length,
          };
          return adminDesigner;
        }),
      );
      return {
        ...s,
        salonEntryToken,
        salonEntryPath: customerEntryPath(salonEntryToken),
        designers: designerCounts,
      };
    }),
  );

  return {
    salons: adminSalons,
    consultations: consultations.map(toListItem),
    errors,
  };
}

/**
 * 디자이너 개인 인박스 — 디자이너 staffToken 으로 진입(P0).
 * - mine: 본인에게 배정된 상담
 * - unassigned: 같은 살롱의 미배정(살롱 공용 QR 진입) 상담 — '내 손님으로 가져오기' 가능
 */
export async function getDesignerInbox(staffToken: string): Promise<{
  designer: Designer;
  salon: PublicSalon;
  mine: ConsultationListItem[];
  unassigned: ConsultationListItem[];
} | null> {
  const repo = getRepo();
  // 레이트리밋(P0) — staffToken당 분당 인박스 조회 상한(폴 폭주/열거 완화).
  await enforceRate(`inbox:${staffToken}`, 30, 60_000, { source: "inbox" });
  const designer = await repo.getDesignerByStaffToken(staffToken);
  if (!designer) {
    await logIssue({
      severity: "warning",
      source: "inbox",
      message: "디자이너 인박스 staffToken 검증 실패",
    });
    return null;
  }
  const salon = await repo.getSalon(designer.salonSlug);
  if (!salon) {
    await logIssue({
      salonSlug: designer.salonSlug,
      severity: "warning",
      source: "inbox",
      message: "디자이너 인박스 살롱 조회 실패",
    });
    return null;
  }
  const [mine, unassigned] = await Promise.all([
    repo.listConsultations({ designerId: designer.id, limit: 100 }),
    repo.listConsultations({
      salonSlug: salon.slug,
      unassignedOnly: true,
      limit: 100,
    }),
  ]);
  return {
    designer,
    salon: toPublicSalon(salon),
    mine: mine.map(toListItem),
    unassigned: unassigned.map(toListItem),
  };
}

/* ── 캡슐 토큰 last_seen — 진입점(오너 콘솔·디자이너 인박스 "페이지")에서만 호출 ──────
 * 유출 감지 soft 신호. 공유 서비스(getSalonConsole/getDesignerInbox)에 두면 어드민 뷰·액션 래퍼에도
 * 물려 신호가 오염되므로, "본인이 자기 링크를 연" 실제 진입점 페이지에서만 기록한다.
 * after() 응답 후 백그라운드 · 스로틀(repo) · best-effort(실패 삼킴). ip 는 위조 불가 소스만(없으면 null). */
export function recordOwnerTokenSeen(salonSlug: string, ip: string | null): void {
  after(() => getRepo().touchOwnerTokenSeen(salonSlug, ip).catch(() => {}));
}
export function recordStaffTokenSeen(designerId: string, ip: string | null): void {
  after(() => getRepo().touchStaffTokenSeen(designerId, ip).catch(() => {}));
}

/**
 * 미배정 상담을 디자이너에게 배정('내 손님으로 가져오기').
 * staffToken 으로 디자이너 검증 후, consultationToken(=designerToken) 으로 상담을 찾아 배정.
 */
export async function assignConsultation(
  staffToken: string,
  consultationToken: string,
): Promise<{ ok: boolean }> {
  const repo = getRepo();
  // 레이트리밋(P0) — staffToken당 분당 배정 상한(재배정 스팸 방지).
  await enforceRate(`assign:${staffToken}`, 20, 60_000, { source: "inbox" });
  const designer = await repo.getDesignerByStaffToken(staffToken);
  if (!designer) {
    await logIssue({
      severity: "warning",
      source: "inbox",
      message: "상담 배정 staffToken 검증 실패",
    });
    return { ok: false };
  }
  const c = await repo.getByDesignerToken(consultationToken);
  if (!c || c.salonSlug !== designer.salonSlug) {
    await logIssue({
      salonSlug: designer.salonSlug,
      severity: "warning",
      source: "inbox",
      message: "상담 배정 대상 조회 실패(토큰 불일치/타 살롱)",
    });
    return { ok: false };
  }
  // 조건부 배정 — 이미 다른 디자이너가 집었으면 실패(double-grab 방지).
  const ok = await repo.assignConsultation(
    c.id,
    { id: designer.id, name: designer.name },
    { onlyIfUnassigned: true },
  );
  return { ok };
}

/* ──────────────────────────────────────────────────────────────
 * 살롱 오너 콘솔 (ownerToken 권한) — 메뉴/디자이너/직급 편집.
 * 모든 함수가 ownerToken 으로 살롱을 확정한 뒤 그 살롱 스코프만 강제한다.
 * (클라가 보낸 salonSlug 는 신뢰하지 않는다 — ownerToken 이 권위.)
 * ──────────────────────────────────────────────────────────────── */

/** 콘솔 권한 확인 — 무효 토큰이면 logIssue(warning) + null. */
async function authorizeConsole(
  ownerToken: string,
  source: string,
): Promise<Salon | null> {
  const salon = await getRepo().getSalonByOwnerToken(ownerToken);
  if (!salon) {
    await logIssue({
      severity: "warning",
      source,
      message: "살롱 콘솔 ownerToken 검증 실패",
      detail: `token=${(ownerToken ?? "").slice(0, 12)}…`,
    });
    return null;
  }
  return salon;
}

export interface SalonConsoleData {
  salon: OwnerConsoleSalon;
  designers: Designer[];
  categories: SalonServiceCategory[];
  services: SalonService[];
  consultations: ConsultationListItem[];
  /** 디자이너/살롱 공용 QR 발급용(서버 서명 토큰 + 경로) */
  designerEntries: {
    id: string;
    entryToken: string;
    entryPath: string;
    inboxPath: string;
  }[];
  salonEntryToken: string;
  salonEntryPath: string;
}

/** 콘솔 초기 데이터 로드(ownerToken 검증 필수). 무효면 null. */
export async function getSalonConsole(
  ownerToken: string,
): Promise<SalonConsoleData | null> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return null;
  const repo = getRepo();
  const [designers, categories, services, consultations] = await Promise.all([
    repo.listDesigners(salon.slug),
    repo.listServiceCategories(salon.slug),
    repo.listServices(salon.slug),
    repo.listConsultations({ salonSlug: salon.slug, limit: 100 }),
  ]);
  const salonEntryToken = makeSalonEntryToken(salon.slug, salon.entryKeyVersion);
  return {
    // 비밀(ownerToken·ownerEmail) strip 투영 — 콘솔 편집용 designerRanks 는 유지.
    salon: toOwnerConsoleSalon(salon),
    designers,
    categories,
    services,
    consultations: consultations.map(toListItem),
    designerEntries: designers.map((d) => {
      const entryToken = makeDesignerEntryToken(d.id, d.entryKeyVersion);
      return {
        id: d.id,
        entryToken,
        entryPath: customerEntryPath(entryToken),
        inboxPath: designerInboxPath(d.staffToken),
      };
    }),
    salonEntryToken,
    salonEntryPath: customerEntryPath(salonEntryToken),
  };
}

/** catalogId(슬러그 접미) 안전화 — 신규 카테고리/시술 id 생성용. */
function slugifyCatalogId(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || `c${cryptoToken().slice(0, 8)}`;
}

/** 가격 정규화 — 음수/NaN 차단, 0 이상 정수(원). */
function normalizePrice(won: number): number {
  if (!Number.isFinite(won) || won < 0) return 0;
  return Math.round(won);
}

/** rankPrices 정규화 — 살롱이 정의한 rankId 만 허용, 양수만 유지. */
function normalizeRankPrices(
  raw: Record<string, number> | undefined,
  ranks: DesignerRank[],
): Record<string, number> | undefined {
  if (!raw) return undefined;
  const allowed = new Set(ranks.map((r) => r.id));
  const out: Record<string, number> = {};
  for (const [rankId, won] of Object.entries(raw)) {
    if (!allowed.has(rankId)) continue;
    if (!Number.isFinite(won) || won <= 0) continue;
    out[rankId] = Math.round(won);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 직급 id 정규화/생성 — 소문자/숫자/하이픈만. 빈 결과는 랜덤 폴백.
 * 신규 직급(id 미지정)은 label 에서 생성하고, 같은 호출 내 중복 id 는
 * `-2`, `-3` … 접미로 회피한다.
 */
function normalizeRankId(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || `r${cryptoToken().slice(0, 8)}`;
}

/**
 * 살롱 직급(rank) 정의 교체(콘솔). authorizeConsole 게이트 후 repo.updateSalonRanks.
 * 입력 검증:
 *  - ranks 는 배열, 각 항목 {id?,label} 의 label(LocalizedText) 의 ko 가 비어있지 않게.
 *  - 최종 id 는 소문자/숫자/하이픈으로 정규화(id 미지정 시 label.ko 에서 생성).
 *  - 최종 id 중복 금지(중복이면 -2, -3 … 접미로 유일화).
 *  - 최소 0개 허용(전부 삭제 가능).
 *  - label 의 ja/en/zh 는 optional(없으면 tx() 가 ko 폴백) — ko 만 필수.
 * 정합 가드(best-effort, throw 금지): 새 ranks 에서 사라진 rankId 를 참조하는
 *  (a) 디자이너 → rankId=undefined, (b) 시술 rankPrices 의 해당 키 제거.
 *  실패해도 logIssue(warning) 후 진행(기본가 basePriceFrom 은 유지).
 */
export async function salonUpdateRanks(
  ownerToken: string,
  ranks: DesignerRank[],
): Promise<{ ok: boolean }> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();

  if (!Array.isArray(ranks)) return { ok: false };

  // 정규화 + 검증(label.ko 필수) + id 유일화.
  // label 은 LocalizedText — ko trim 비면 거부. ja/en/zh 는 optional(미입력 시 ko 폴백).
  const seen = new Set<string>();
  const normalized: DesignerRank[] = [];
  for (const r of ranks) {
    const label = r?.label;
    const ko = (label?.ko ?? "").trim();
    if (!ko) return { ok: false };
    // ko 는 trim 본문으로 정규화. ja/en 은 LocalizedText 의 required 필드라 미입력 시 ko 로 폴백
    // (tx() 의 폴백과 동일 결과 — 손님 언어 칸을 안 채워도 ko 가 보인다). zh 는 입력 있을 때만 보존.
    const ja = label?.ja?.trim() || ko;
    const en = label?.en?.trim() || ko;
    const zh = label?.zh?.trim();
    const cleanLabel: LocalizedText = zh ? { ko, ja, en, zh } : { ko, ja, en };
    const rawId = (r?.id ?? "").trim() || ko;
    let id = normalizeRankId(rawId);
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    seen.add(id);
    normalized.push({ id, label: cleanLabel });
  }

  await repo.updateSalonRanks(salon.slug, normalized);

  // ── 정합 가드: 사라진 rankId 참조 정리(best-effort) ──────────────
  const kept = new Set(normalized.map((r) => r.id));

  // (a) 디자이너: 사라진 직급 참조 → undefined.
  try {
    const designers = await repo.listDesigners(salon.slug);
    for (const d of designers) {
      if (d.rankId && !kept.has(d.rankId)) {
        await repo.updateDesigner({ ...d, rankId: undefined });
      }
    }
  } catch (e) {
    await logIssue({
      salonSlug: salon.slug,
      severity: "warning",
      source: "console",
      message: "직급 변경: 디자이너 rankId 정리 실패(best-effort)",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // (b) 시술 rankPrices: 사라진 키 제거(기본가 유지).
  try {
    const services = await repo.listServices(salon.slug);
    for (const s of services) {
      if (!s.rankPrices) continue;
      const staleKeys = Object.keys(s.rankPrices).filter((k) => !kept.has(k));
      if (staleKeys.length === 0) continue;
      const nextPrices: Record<string, number> = {};
      for (const [k, v] of Object.entries(s.rankPrices)) {
        if (kept.has(k)) nextPrices[k] = v;
      }
      await repo.upsertService({
        ...s,
        rankPrices: Object.keys(nextPrices).length ? nextPrices : undefined,
      });
    }
  } catch (e) {
    await logIssue({
      salonSlug: salon.slug,
      severity: "warning",
      source: "console",
      message: "직급 변경: 시술 rankPrices 정리 실패(best-effort)",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  return { ok: true };
}

/** 카테고리 추가/수정(콘솔). id 없으면 라벨에서 생성, salonSlug 강제. */
export async function salonUpsertCategory(input: {
  ownerToken: string;
  id?: string;
  label: LocalizedText;
  sort?: number;
}): Promise<{ ok: boolean; category?: SalonServiceCategory }> {
  const salon = await authorizeConsole(input.ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();

  let id = input.id;
  if (id) {
    // 기존 카테고리만 수정 가능(타 살롱 id 거부).
    const existing = (await repo.listServiceCategories(salon.slug)).find(
      (c) => c.id === id,
    );
    if (!existing) {
      await logIssue({
        salonSlug: salon.slug,
        severity: "warning",
        source: "console",
        message: "카테고리 수정 대상 불일치(타 살롱/없음)",
        detail: `id=${id}`,
      });
      return { ok: false };
    }
  } else {
    id = `${salon.slug}:${slugifyCatalogId(input.label.ko ?? "category")}`;
  }

  const existingList = await repo.listServiceCategories(salon.slug);
  const sort =
    typeof input.sort === "number"
      ? input.sort
      : existingList.length
        ? Math.max(...existingList.map((c) => c.sort)) + 1
        : 1;

  const category: SalonServiceCategory = {
    id,
    salonSlug: salon.slug,
    label: input.label,
    sort,
  };
  await repo.upsertServiceCategory(category);
  return { ok: true, category };
}

/** 시술 추가/수정(콘솔). id 없으면 생성, salonSlug·categoryId 검증. */
export async function salonUpsertService(input: {
  ownerToken: string;
  id?: string;
  categoryId: string;
  label: LocalizedText;
  basePriceFrom: number;
  rankPrices?: Record<string, number>;
  active?: boolean;
}): Promise<{ ok: boolean; service?: SalonService }> {
  const salon = await authorizeConsole(input.ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();

  // categoryId 는 반드시 그 살롱 소유여야 한다.
  const categories = await repo.listServiceCategories(salon.slug);
  if (!categories.some((c) => c.id === input.categoryId)) {
    await logIssue({
      salonSlug: salon.slug,
      severity: "warning",
      source: "console",
      message: "시술 저장 카테고리 불일치(타 살롱/없음)",
      detail: `categoryId=${input.categoryId}`,
    });
    return { ok: false };
  }

  let id = input.id;
  if (id) {
    const existing = (await repo.listServices(salon.slug)).find(
      (s) => s.id === id,
    );
    if (!existing) {
      await logIssue({
        salonSlug: salon.slug,
        severity: "warning",
        source: "console",
        message: "시술 수정 대상 불일치(타 살롱/없음)",
        detail: `id=${id}`,
      });
      return { ok: false };
    }
  } else {
    id = `${salon.slug}:${slugifyCatalogId(input.label.ko ?? "service")}-${cryptoToken().slice(0, 4)}`;
  }

  const service: SalonService = {
    id,
    salonSlug: salon.slug,
    categoryId: input.categoryId,
    label: input.label,
    basePriceFrom: normalizePrice(input.basePriceFrom),
    rankPrices: normalizeRankPrices(input.rankPrices, salon.designerRanks),
    active: input.active ?? true,
  };
  await repo.upsertService(service);
  return { ok: true, service };
}

/** 시술 삭제(콘솔). 그 살롱 소유 id 만. */
export async function salonDeleteService(input: {
  ownerToken: string;
  id: string;
}): Promise<{ ok: boolean }> {
  const salon = await authorizeConsole(input.ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();
  const owned = (await repo.listServices(salon.slug)).some(
    (s) => s.id === input.id,
  );
  if (!owned) {
    await logIssue({
      salonSlug: salon.slug,
      severity: "warning",
      source: "console",
      message: "시술 삭제 대상 불일치(타 살롱/없음)",
      detail: `id=${input.id}`,
    });
    return { ok: false };
  }
  await repo.deleteService(input.id);
  return { ok: true };
}

/** 디자이너 추가/수정(콘솔). id 없으면 신규 발급, 있으면 그 살롱 소속만 수정. */
export async function salonUpsertDesigner(input: {
  ownerToken: string;
  id?: string;
  name: string;
  rankId?: string;
  email?: string;
}): Promise<{ ok: boolean; designer?: Designer; tempPassword?: string }> {
  const salon = await authorizeConsole(input.ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();

  const name = input.name?.trim();
  if (!name) return { ok: false };

  // rankId 는 살롱 정의 직급만 허용(미정의면 무시).
  const rankId =
    input.rankId && salon.designerRanks.some((r) => r.id === input.rankId)
      ? input.rankId
      : undefined;

  let designer: Designer;
  if (input.id) {
    const existing = await repo.getDesignerById(input.id);
    if (!existing || existing.salonSlug !== salon.slug) {
      await logIssue({
        salonSlug: salon.slug,
        severity: "warning",
        source: "console",
        message: "디자이너 수정 대상 불일치(타 살롱/없음)",
        detail: `id=${input.id}`,
      });
      return { ok: false };
    }
    const updated: Designer = { ...existing, name, rankId };
    await repo.updateDesigner(updated);
    designer = updated;
  } else {
    designer = await repo.createDesigner({ salonSlug: salon.slug, name, rankId });
  }

  // 이메일 지정 + 아직 계정 없으면 계정 발급 + 소속(staff.email) 부착(중복 방지).
  let tempPassword: string | undefined;
  const email = input.email?.trim();
  if (email && !designer.email) {
    try {
      const res = await provisionAccount({ email, role: "designer", displayName: name });
      await repo.setStaffEmail(designer.id, email);
      designer = { ...designer, email };
      tempPassword = res.tempPassword;
      await logIssue({
        salonSlug: salon.slug,
        severity: "info",
        source: "audit",
        message: "디자이너 계정 발급",
        detail: email,
      });
    } catch (e) {
      await logIssue({
        salonSlug: salon.slug,
        severity: "warning",
        source: "console",
        message: "디자이너 계정 발급 실패",
        detail: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return { ok: true, designer, tempPassword };
}

/** 어드민/오너: 기존 살롱에 오너 계정 발급(백필). ownerToken 게이트. */
export async function adminProvisionOwner(
  ownerToken: string,
  email: string,
): Promise<{ ok: boolean; tempPassword?: string; error?: string }> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return { ok: false, error: "권한 없음" };
  if (salon.ownerEmail) {
    return { ok: false, error: "이미 오너 계정이 있습니다." };
  }
  const e = email?.trim();
  if (!e) return { ok: false, error: "이메일 필수" };
  try {
    const res = await provisionAccount({
      email: e,
      role: "owner",
      displayName: salon.name,
    });
    await getRepo().setSalonOwnerEmail(salon.slug, e);
    await logIssue({
      salonSlug: salon.slug,
      severity: "info",
      source: "audit",
      message: "오너 계정 발급",
      detail: e,
    });
    return { ok: true, tempPassword: res.tempPassword };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "발급 실패" };
  }
}

/* ──────────────────────────────────────────────────────────────
 * QR 재발급(키 회전) — entryKeyVersion + 1 (P1).
 * 유출/퇴사 QR 을 앱에서 폐기한다. 회전 후 기존 QR 은 resolveEntry 의
 * 버전 대조에서 무효 처리되고, 새 토큰은 회전된 version 으로 재발급한다.
 * 오너 콘솔(ownerToken) 권한으로 살롱·소속 디자이너 QR 을 재발급.
 * ──────────────────────────────────────────────────────────────── */

/** 살롱 공용 QR 재발급(콘솔) — entryKeyVersion+1 후 새 입장 토큰/경로 반환. */
export async function rotateSalonEntryKey(
  ownerToken: string,
): Promise<{ ok: boolean; entryToken?: string; entryPath?: string; version?: number }> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();
  const version = salon.entryKeyVersion + 1;
  await repo.updateSalonEntryKeyVersion(salon.slug, version);
  const entryToken = makeSalonEntryToken(salon.slug, version);
  return {
    ok: true,
    entryToken,
    entryPath: customerEntryPath(entryToken),
    version,
  };
}

/**
 * 오너 콘솔 접근 토큰(ownerToken) 회전 — 새 강한 랜덤으로 교체.
 * 기존 콘솔 링크(/ko/s/{old})는 즉시 무효화된다(유출 대응/재발급).
 * authorizeConsole 게이트(기존 토큰 보유자=어드민 패널 또는 오너만 호출 가능).
 * 살롱은 slug 로 식별되므로 어드민 패널은 회전 후 재조회(by slug)로 새 토큰을 받는다.
 */
export async function rotateOwnerToken(
  ownerToken: string,
): Promise<{ ok: boolean; ownerToken?: string; consolePath?: string }> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();
  const next = `owner_${randomBytes(24).toString("base64url")}`;
  // rotate=복구 → 새 토큰 세팅 + revoke 클리어를 한 UPDATE로 원자적으로
  // (2단계면 사이 실패 시 새 토큰+revoked=true=영구 락아웃).
  await repo.updateSalonOwnerToken(salon.slug, next);
  return { ok: true, ownerToken: next, consolePath: salonConsolePath(next) };
}

/** 디자이너 QR 재발급(콘솔) — 그 살롱 소속 디자이너만, entryKeyVersion+1. */
export async function rotateDesignerEntryKey(input: {
  ownerToken: string;
  designerId: string;
}): Promise<{ ok: boolean; entryToken?: string; entryPath?: string; version?: number }> {
  const salon = await authorizeConsole(input.ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();
  const existing = await repo.getDesignerById(input.designerId);
  if (!existing || existing.salonSlug !== salon.slug) {
    await logIssue({
      salonSlug: salon.slug,
      severity: "warning",
      source: "console",
      message: "디자이너 QR 재발급 대상 불일치(타 살롱/없음)",
      detail: `id=${input.designerId}`,
    });
    return { ok: false };
  }
  const version = existing.entryKeyVersion + 1;
  await repo.updateDesigner({ ...existing, entryKeyVersion: version });
  const entryToken = makeDesignerEntryToken(existing.id, version);
  return {
    ok: true,
    entryToken,
    entryPath: customerEntryPath(entryToken),
    version,
  };
}

/**
 * 디자이너 인박스 토큰(staff_token) 재발급 — 인박스 링크 유출 대응.
 * 옛 인박스 URL 은 즉시 무효. 디자이너에게 새 링크를 전달해야 한다.
 * (QR/입장 토큰은 rotateDesignerEntryKey 로 별도 회전 — 이건 인박스 접근 토큰.)
 */
export async function rotateDesignerStaffToken(input: {
  ownerToken: string;
  designerId: string;
}): Promise<{ ok: boolean; staffToken?: string; inboxPath?: string }> {
  const salon = await authorizeConsole(input.ownerToken, "console");
  if (!salon) return { ok: false };
  const repo = getRepo();
  const existing = await repo.getDesignerById(input.designerId);
  if (!existing || existing.salonSlug !== salon.slug) {
    await logIssue({
      salonSlug: salon.slug,
      severity: "warning",
      source: "console",
      message: "인박스 토큰 재발급 대상 불일치(타 살롱/없음)",
      detail: `id=${input.designerId}`,
    });
    return { ok: false };
  }
  const staffToken = `staff_${cryptoToken()}`;
  // 토큰 발급 = 새 토큰 세팅 + revoke 클리어를 한 UPDATE로 원자적으로(락아웃 방지).
  // (updateDesigner 는 제네릭 편집이라 토큰-write 경로가 아님 — 전용 메서드로.)
  await repo.updateDesignerStaffToken(input.designerId, staffToken);
  return { ok: true, staffToken, inboxPath: designerInboxPath(staffToken) };
}

/* ──────────────────────────────────────────────────────────────
 * 플랫폼 어드민 온보딩 (세션 쿠키 권한) — 살롱/디자이너 생성.
 * ──────────────────────────────────────────────────────────────── */

/**
 * 어드민 세션 게이트 — Google 어드민 세션 OR 공유키 세션(브레이크글래스) 중 하나면 통과.
 * 프로바이더 미설정 시 getAdminUser()는 null → 공유키가 오늘과 동일하게 필수(비파괴).
 */
async function ensureAdminSession(salonSlug?: string): Promise<void> {
  if (!(await getAdminUser()) && !(await readAdminSession())) {
    await logIssue({
      salonSlug,
      severity: "warning",
      source: "admin",
      message: "어드민 인증 실패",
    });
    throw new Error("어드민 인증에 실패했습니다.");
  }
}

export interface CreatedSalonResult {
  salon: Salon;
  consolePath: string; // /ko/s/{ownerToken}
  salonEntryToken: string;
  salonEntryPath: string;
  /** ownerEmail 지정 시 발급된 초기 비밀번호(어드민이 오너에게 전달). */
  ownerTempPassword?: string;
}

/** 살롱 생성(어드민). ownerToken·콘솔 링크·공용 QR 토큰을 함께 반환. */
export async function adminCreateSalon(
  input: {
    slug: string;
    name: string;
    address?: string;
    ownerEmail?: string;
  },
): Promise<CreatedSalonResult> {
  await ensureAdminSession();
  const repo = getRepo();

  const slug = input.slug?.trim();
  const name = input.name?.trim();
  if (!slug || !name) throw new Error("slug 와 이름은 필수입니다.");
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("slug 는 소문자/숫자/하이픈만 가능합니다.");
  }
  if (await repo.getSalon(slug)) {
    throw new Error("이미 존재하는 slug 입니다.");
  }

  const salon = await repo.createSalon({
    slug,
    name,
    address: input.address?.trim() || undefined,
    // 기본 직급(원장/실장/디자이너) 명시 — 드라이버 무관하게 항상 채워 콘솔
    // "디자이너 추가" 직급 선택이 비지 않게 한다.
    designerRanks: DEFAULT_DESIGNER_RANKS,
  });

  // 신규 살롱에 기본 카테고리 1개를 깔아 콘솔에서 곧바로 시술 추가가 가능하게 한다.
  await repo.upsertServiceCategory({
    id: `${salon.slug}:cut`,
    salonSlug: salon.slug,
    label: { ko: "컷", ja: "カット", en: "Cut" },
    sort: 1,
  });

  // 오너 이메일 지정 시 계정 발급 + 매핑(세션 로그인 진입).
  // 실패(중복 이메일 등)해도 살롱 생성을 orphan 시키지 않도록 격리 — 오너 계정만
  // 미발급으로 두고(어드민이 나중에 adminProvisionOwner 로 재시도) 살롱은 유지한다.
  let ownerTempPassword: string | undefined;
  const ownerEmail = input.ownerEmail?.trim();
  if (ownerEmail) {
    try {
      const { tempPassword } = await provisionAccount({
        email: ownerEmail,
        role: "owner",
        displayName: name,
      });
      await repo.setSalonOwnerEmail(salon.slug, ownerEmail);
      ownerTempPassword = tempPassword;
    } catch (e) {
      await logIssue({
        salonSlug: salon.slug,
        severity: "warning",
        source: "console",
        message: "살롱 생성 중 오너 계정 발급 실패(살롱은 유지)",
        detail: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  const salonEntryToken = makeSalonEntryToken(salon.slug, salon.entryKeyVersion);
  return {
    salon,
    consolePath: salonConsolePath(salon.ownerToken),
    salonEntryToken,
    salonEntryPath: customerEntryPath(salonEntryToken),
    ownerTempPassword,
  };
}

export interface CreatedDesignerResult {
  designer: Designer;
  entryToken: string;
  entryPath: string;
  inboxPath: string;
  /** email 지정 시 발급된 초기 비밀번호(오너/어드민이 디자이너에게 전달). */
  tempPassword?: string;
}

/* ── 공지(어드민) ─────────────────────────────────────────── */

export async function adminListAnnouncements(): Promise<Announcement[]> {
  await ensureAdminSession();
  return getRepo().listAnnouncements();
}

export async function adminCreateAnnouncement(
  input: NewAnnouncement,
): Promise<Announcement> {
  await ensureAdminSession();
  const ko = input.title?.ko?.trim();
  if (!ko) throw new Error("제목(ko)은 필수입니다.");
  return getRepo().createAnnouncement({
    title: input.title,
    body: input.body,
    audience: input.audience,
    salonSlugs: input.salonSlugs,
  });
}

export async function adminSetAnnouncementActive(
  id: string,
  active: boolean,
): Promise<void> {
  await ensureAdminSession();
  if (!id) throw new Error("id 필수");
  await getRepo().setAnnouncementActive(id, active);
}

/** 디자이너 활성/비활성 토글(어드민 전역). */
export async function adminSetDesignerActive(
  designerId: string,
  active: boolean,
): Promise<void> {
  await ensureAdminSession();
  if (!designerId) throw new Error("designerId 필수");
  await getRepo().setDesignerActive(designerId, active);
}

/* ── 고객센터 이슈 메모(어드민) ─────────────────────────────── */

export async function adminListSupportNotes(
  consultationId: string,
): Promise<SupportNote[]> {
  await ensureAdminSession();
  if (!consultationId) return [];
  return getRepo().listSupportNotes(consultationId);
}

export async function adminAddSupportNote(
  input: NewSupportNote,
): Promise<SupportNote> {
  await ensureAdminSession();
  const body = input.body?.trim();
  if (!input.consultationId || !body) throw new Error("상담·내용은 필수입니다.");
  const author = input.author ?? (await getAdminUser())?.email;
  return getRepo().addSupportNote({
    consultationId: input.consultationId,
    body,
    author,
  });
}

/** 노출용 공지(해석 완료) — title/body 는 대상 로케일로 폴백 해석. */
export interface ActiveAnnouncement {
  id: string;
  title: string;
  body: string;
}

/**
 * 활성 공지 조회(공개 — 어드민 게이트 없음, active 만 노출).
 * 필터: active ∧ audience ∈ audiences ∧ (전체 대상 || salonSlug 포함) ∧ 노출기간.
 * (살롱 스태프 화면은 audiences=["salon","platform"] — platform 은 전 살롱 브로드캐스트.)
 * title/body 는 locale → ko 폴백. 최신순.
 */
export async function getActiveAnnouncements(opts: {
  audiences: AnnouncementAudience[];
  salonSlug?: string;
  locale: string;
}): Promise<ActiveAnnouncement[]> {
  const all = await getRepo()
    .listAnnouncements()
    .catch(() => [] as Announcement[]);
  const now = new Date().toISOString();
  const loc = opts.locale as Locale;
  return all
    .filter((a) => a.active && opts.audiences.includes(a.audience))
    .filter(
      (a) =>
        a.salonSlugs.length === 0 ||
        (opts.salonSlug ? a.salonSlugs.includes(opts.salonSlug) : false),
    )
    .filter(
      (a) =>
        (!a.activeFrom || a.activeFrom <= now) &&
        (!a.activeTo || a.activeTo >= now),
    )
    .map((a) => ({
      id: a.id,
      title: a.title[loc] ?? a.title.ko ?? "",
      body: a.body[loc] ?? a.body.ko ?? "",
    }))
    .filter((a) => a.title || a.body);
}

/** 디자이너 생성(어드민). staffToken/QR/인박스 경로 반환(전달용). */
export async function adminCreateDesigner(
  input: {
    salonSlug: string;
    name: string;
    rankId?: string;
    email?: string;
  },
): Promise<CreatedDesignerResult> {
  await ensureAdminSession();
  const repo = getRepo();

  const salon = await repo.getSalon(input.salonSlug);
  if (!salon) throw new Error("살롱을 찾을 수 없습니다.");
  const name = input.name?.trim();
  if (!name) throw new Error("이름은 필수입니다.");
  const rankId =
    input.rankId && salon.designerRanks.some((r) => r.id === input.rankId)
      ? input.rankId
      : undefined;

  const designer = await repo.createDesigner({
    salonSlug: salon.slug,
    name,
    rankId,
  });

  // email 지정 시 디자이너 계정 발급 + 소속(staff.email) 매핑. 실패해도 디자이너는 유지.
  let tempPassword: string | undefined;
  const email = input.email?.trim();
  if (email) {
    try {
      const res = await provisionAccount({ email, role: "designer", displayName: name });
      await repo.setStaffEmail(designer.id, email);
      tempPassword = res.tempPassword;
    } catch (e) {
      await logIssue({
        salonSlug: salon.slug,
        severity: "warning",
        source: "console",
        message: "디자이너 생성 중 계정 발급 실패(디자이너는 유지)",
        detail: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  const entryToken = makeDesignerEntryToken(
    designer.id,
    designer.entryKeyVersion,
  );
  return {
    designer,
    entryToken,
    entryPath: customerEntryPath(entryToken),
    inboxPath: designerInboxPath(designer.staffToken),
    tempPassword,
  };
}

/* ── 디자이너 초대 링크 (Phase 0b) ─────────────────────────── */

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14일

/** 오너 콘솔에서 초대 링크 발급(ownerToken 게이트). 단일사용/만료. */
export async function salonCreateInvite(
  ownerToken: string,
): Promise<{ ok: boolean; path?: string }> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return { ok: false };
  const token = cryptoToken();
  await getRepo().createSalonInvite({
    token,
    salonSlug: salon.slug,
    createdBy: "owner",
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  });
  return { ok: true, path: invitePath(token) };
}

export interface SalonInviteView {
  token: string;
  path: string;
  status: "active" | "used" | "revoked" | "expired";
  createdAt: string;
}

/** 오너 콘솔: 발급 초대 목록(상태 계산). */
export async function salonListInvites(
  ownerToken: string,
): Promise<SalonInviteView[]> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return [];
  const now = new Date().toISOString();
  const invites = await getRepo().listSalonInvites(salon.slug);
  return invites.map((i) => ({
    token: i.token,
    path: invitePath(i.token),
    createdAt: i.createdAt,
    status: i.revoked
      ? "revoked"
      : i.usedAt
        ? "used"
        : i.expiresAt && i.expiresAt < now
          ? "expired"
          : "active",
  }));
}

/** 오너 콘솔: 초대 취소(본인 살롱 것만). */
export async function salonRevokeInvite(
  ownerToken: string,
  token: string,
): Promise<{ ok: boolean }> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return { ok: false };
  const inv = await getRepo().getSalonInvite(token);
  if (!inv || inv.salonSlug !== salon.slug) return { ok: false };
  await getRepo().revokeSalonInvite(token);
  await logIssue({
    salonSlug: salon.slug,
    severity: "info",
    source: "audit",
    message: "초대 취소",
    detail: token.slice(-8),
  });
  return { ok: true };
}

/* ── 오너 콘솔 인사이트 (ownerToken 게이트, 살롱 스코프로 어드민 함수 재사용) ── */

/** 오너: 내 살롱 분석(어드민 분석을 salonSlug 스코프로). */
export async function salonOwnerAnalytics(
  ownerToken: string,
  range: AnalyticsRange,
): Promise<AdminAnalytics | null> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return null;
  return getAdminAnalytics({ range, salonSlug: salon.slug });
}

/** 오너: 내 소속 디자이너 성과. */
export async function salonOwnerDesigners(
  ownerToken: string,
): Promise<AdminDesignerStats[]> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return [];
  const all = await getAdminDesigners();
  return all.filter((d) => d.salonSlug === salon.slug);
}

/** 오너: 내 살롱 발급 리포트(살롱명 매칭). */
export async function salonOwnerReports(
  ownerToken: string,
): Promise<AdminReportRow[]> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return [];
  const { rows } = await getAdminReports({ limit: 2000 });
  // 테넌트 격리는 unique **slug** 로(name 은 non-unique → 동명 살롱 유출). slug 있는 행만 노출.
  return rows.filter((r) => r.salonSlug === salon.slug);
}

/** 초대 유효성 + 대상 살롱명(가입 화면 표시용). 무효면 null. */
export async function getInviteView(
  token: string,
): Promise<{ salonName: string } | null> {
  // 초대 토큰 프로빙 방어 — IP당 분당 30회 초과 시 무효 취급.
  const h = await headers();
  const ip =
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await rateLimitOk(`invite-view:${ip}`, 30, 60_000, "invite"))) {
    return null;
  }
  const inv = await getRepo().getSalonInvite(token);
  if (!inv || inv.revoked || inv.usedAt) return null;
  if (inv.expiresAt && inv.expiresAt < new Date().toISOString()) return null;
  const salon = await getRepo().getSalon(inv.salonSlug);
  return salon ? { salonName: salon.name } : null;
}

/**
 * 초대 수락 = 디자이너 가입 + 소속 확정.
 * 초대가 오너 보증이므로 계정은 자동확인(email_confirm). 단일사용 마킹.
 * 인증 없음(공개) — 유효 초대 토큰이 게이트.
 */
export async function acceptSalonInvite(input: {
  token: string;
  email: string;
  password: string;
  name: string;
}): Promise<{ ok: boolean; email?: string; error?: string }> {
  const repo = getRepo();
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name || !email) return { ok: false, error: "이름·이메일은 필수입니다." };

  // rate limit(공개 계정 생성 — IP당 분당 10회).
  try {
    const h = await headers();
    const ip =
      h.get("x-real-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    await enforceRate(`accept-invite:${ip}`, 10, 60_000, { source: "invite" });
  } catch {
    return { ok: false, error: "잠시 후 다시 시도해 주세요." };
  }

  // 어드민 allowlist·기존 오너/스태프 이메일로는 초대 수락 불가(승격·중복 차단).
  if (await selfProvisionBlocked(email)) {
    return { ok: false, error: "이 이메일로는 가입할 수 없습니다." };
  }

  // 원자적 단일사용 소비(레이스 방지) — 유효할 때만 used 마킹 후 반환.
  // 이 시점부터 초대는 "선점"됨. 이후 어떤 실패든 반드시 reopenSalonInvite 로 원복해야
  // 단일사용 초대가 영구 소진되지 않는다(claim+rollback, completeConsultation 과 동형).
  const inv = await repo.consumeSalonInvite(input.token);
  if (!inv) return { ok: false, error: "유효하지 않은 초대입니다." };

  try {
    const salon = await repo.getSalon(inv.salonSlug);
    if (!salon) {
      await repo.reopenSalonInvite(input.token);
      return { ok: false, error: "살롱을 찾을 수 없습니다." };
    }
    await provisionAccount({
      email,
      role: "designer",
      displayName: name,
      password: input.password,
    });
    const designer = await repo.createDesigner({ salonSlug: salon.slug, name });
    await repo.setStaffEmail(designer.id, email);
    await logIssue({
      salonSlug: salon.slug,
      severity: "info",
      source: "audit",
      message: "초대 수락 — 디자이너 가입/소속",
      detail: email,
    });
    return { ok: true, email };
  } catch (e) {
    // 실패 시 초대 원복(재시도 가능케). reopen 자체 실패는 무시(초대는 이미 소진 상태 유지).
    await repo.reopenSalonInvite(input.token).catch(() => {});
    return { ok: false, error: e instanceof Error ? e.message : "가입 실패" };
  }
}

/* ── 자가가입 + 소속 요청 (Phase 0c) ───────────────────────── */

/**
 * 자가발급 금지 이메일 — 어드민 allowlist 또는 이미 오너/스태프인 이메일.
 * 자가가입/초대가 이 이메일로 계정을 발급하지 못하게 막는다(어드민 승격·스쿼팅 차단).
 */
async function selfProvisionBlocked(email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  const repo = getRepo();
  if (await repo.getSalonByOwnerEmail(email)) return true;
  if (await repo.getStaffByEmail(email)) return true;
  return false;
}

/** 디자이너 자가가입(공개) — 계정만 생성(미소속). 이후 초대/요청으로 소속. */
export async function signUpDesigner(input: {
  email: string;
  password: string;
  name: string;
}): Promise<{ ok: boolean; email?: string; error?: string }> {
  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim();
  if (!email || !name) return { ok: false, error: "이름·이메일은 필수입니다." };

  // 스팸 계정 생성 방어 — IP당 분당 5회(공개 엔드포인트).
  try {
    const h = await headers();
    const ip =
      h.get("x-real-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    await enforceRate(`signup:${ip}`, 5, 60_000, { source: "signup" });
  } catch {
    return { ok: false, error: "잠시 후 다시 시도해 주세요." };
  }

  // 어드민 allowlist·기존 오너/스태프 이메일로는 자가가입 불가(승격·스쿼팅 차단).
  if (await selfProvisionBlocked(email)) {
    return { ok: false, error: "이 이메일로는 가입할 수 없습니다." };
  }

  try {
    await provisionAccount({
      email,
      role: "designer",
      displayName: name,
      password: input.password,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "가입 실패" };
  }
  return { ok: true, email };
}

/** 오너 콘솔: 이메일로 가입된 디자이너 검색(정확 일치, 열거 방지). */
export async function salonSearchDesigner(
  ownerToken: string,
  email: string,
): Promise<{ ok: boolean; found?: boolean; name?: string }> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return { ok: false };
  const e = email?.trim();
  if (!e) return { ok: true, found: false };
  const profile = await getRepo().getProfileByEmail(e);
  return {
    ok: true,
    found: !!profile && profile.role === "designer",
    name: profile?.displayName,
  };
}

/** 오너 콘솔: 소속 요청 전송(가입된 디자이너에게). */
export async function salonSendMembershipRequest(
  ownerToken: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const salon = await authorizeConsole(ownerToken, "console");
  if (!salon) return { ok: false, error: "권한 없음" };
  const e = email?.trim();
  if (!e) return { ok: false, error: "이메일 필수" };
  const profile = await getRepo().getProfileByEmail(e);
  if (!profile || profile.role !== "designer") {
    return { ok: false, error: "가입된 디자이너를 찾을 수 없습니다." };
  }
  // 이미 이 살롱 소속이면 요청 불필요.
  const existing = await getRepo().getStaffByEmail(e);
  if (existing && existing.salonSlug === salon.slug) {
    return { ok: false, error: "이미 이 살롱 소속입니다." };
  }
  // 중복 pending 방지(멱등) — DB partial-unique(0020)의 앱단 선방어.
  const pending = await getRepo().listMembershipRequestsByEmail(e);
  if (pending.some((r) => r.salonSlug === salon.slug && r.status === "pending")) {
    return { ok: true };
  }
  await getRepo().createMembershipRequest(salon.slug, e);
  return { ok: true };
}

/** 로그인한 디자이너가 받은 소속 요청(pending). */
export async function listMyMembershipRequests(): Promise<MembershipRequest[]> {
  const acc = await getSessionAccount();
  if (!acc || (acc.role !== "designer" && acc.role !== "designer-unaffiliated")) {
    return [];
  }
  // 소속 대기 홈이 조회 실패로 죽지 않도록 방어(빈 목록으로 degrade).
  try {
    return await getRepo().listMembershipRequestsByEmail(acc.email);
  } catch {
    return [];
  }
}

/** 디자이너가 소속 요청 수락/거절. 수락 시 staff 생성=소속 확정. */
export async function respondMembership(
  requestId: string,
  accept: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const acc = await getSessionAccount();
  if (!acc || (acc.role !== "designer" && acc.role !== "designer-unaffiliated")) {
    return { ok: false, error: "권한 없음" };
  }
  const repo = getRepo();
  const req = await repo.getMembershipRequest(requestId);
  if (!req || req.status !== "pending") {
    return { ok: false, error: "유효하지 않은 요청" };
  }
  if (req.designerEmail.toLowerCase() !== acc.email.toLowerCase()) {
    return { ok: false, error: "본인 요청이 아닙니다." };
  }
  if (!accept) {
    await repo.setMembershipRequestStatus(requestId, "declined");
    return { ok: true };
  }
  const salon = await repo.getSalon(req.salonSlug);
  if (!salon) return { ok: false, error: "살롱 없음" };
  // 원자 전이 — 동시 이중수락 시 승자 1건만 진행(중복 staff 방지).
  const won = await repo.acceptMembershipRequestAtomic(requestId);
  if (!won) return { ok: false, error: "이미 처리된 요청" };
  // 이미 이 살롱 staff 면 재생성 금지(멱등).
  const already = await repo.getStaffByEmail(acc.email);
  if (already && already.salonSlug === salon.slug) {
    return { ok: true };
  }
  try {
    const profile = await repo.getProfileByEmail(acc.email);
    const designer = await repo.createDesigner({
      salonSlug: salon.slug,
      name: profile?.displayName ?? acc.email,
    });
    await repo.setStaffEmail(designer.id, acc.email);
  } catch (e) {
    // staff 생성 실패 시 요청을 pending 으로 되돌려 재시도 가능케(accepted-무staff 교착 방지).
    await repo
      .setMembershipRequestStatus(requestId, "pending")
      .catch(() => {});
    return { ok: false, error: e instanceof Error ? e.message : "합류 실패" };
  }
  await logIssue({
    salonSlug: salon.slug,
    severity: "info",
    source: "audit",
    message: "소속 요청 수락 — 디자이너 합류",
    detail: acc.email,
  });
  return { ok: true };
}
