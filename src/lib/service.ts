import "server-only";
import { randomBytes } from "node:crypto";
import { getRepo } from "@/lib/db";
import {
  DEFAULT_DESIGNER_RANKS,
  toPublicSalon,
  type AdminDesigner,
  type AdminSalon,
  type ConsultationListItem,
  type Designer,
  type DesignerRank,
  type ErrorLog,
  type ErrorSeverity,
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
  formatNextVisit,
  formatPrice,
  PRODUCTS,
  QUICK_REPLIES,
  TIME_PRESETS,
  CROWN_VOLUME,
  HAIR_DENSITY,
  HAIR_TYPE,
} from "@/lib/catalog";
import {
  makeDesignerEntryToken,
  makeSalonEntryToken,
  verifyAdminKey,
  verifyEntryToken,
} from "@/lib/entry";
import {
  customerEntryPath,
  designerInboxPath,
  designerSummaryPath,
  salonConsolePath,
} from "@/lib/links";
import { sendWebPush } from "@/lib/push";
import { ensureDeviceToken, readDeviceToken } from "@/lib/device";
import {
  NATIONALITY_BY_LOCALE,
  type Consultation,
  type ConsultationStatus,
  type Customer,
  type CustomerHairProfile,
  type HairReport,
  type IntakeDraft,
  type Locale,
  type Message,
  type QuickReplyIntent,
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
  await logIssue({
    salonSlug: ctx.salonSlug,
    severity: "warning",
    source: ctx.source,
    message: "레이트리밋 초과",
    detail: `key=${key} count=${count} max=${max}/${windowMs}ms`,
    consultationId: ctx.consultationId,
  });
  throw new RateLimitError();
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
): Promise<void> {
  try {
    const repo = getRepo();
    const subs = await repo.listPushSubscriptions(designerId);
    for (const sub of subs) {
      const res = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      );
      if (res.gone) {
        await repo.deletePushSubscription(sub.endpoint);
      }
    }
  } catch (e) {
    await logIssue({
      source: "push",
      message: "디자이너 알림 발송 실패",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

function levelLabel(items: { id: string; label: Record<Locale, string> }[], id?: string) {
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
    allergy: intake.allergy,
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
  label: Record<Locale, string>;
  sort: number;
}
export interface IntakeMenuService {
  id: string;
  categoryId: string;
  label: Record<Locale, string>;
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
}): Promise<{ consultationToken: string; designerToken: string; consultationId: string }> {
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
    const serviceLabelsKo = resolvedServices.map((s) => s.label.ko);
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
      await notifyDesigner(designerId, {
        title: "새 손님 접수",
        body: summary.headline ?? "새 상담",
        url: designerSummaryPath(consultation.designerToken),
      });
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
        await notifyDesigner(preferred.id, {
          title: isReturning ? "단골 손님 재방문" : "새 손님 접수",
          body: summary.headline ?? "새 상담",
          url: designerSummaryPath(consultation.designerToken),
        });
      } else {
        // 폴백: 그 살롱 디자이너 전원에게 미배정 손님 알림(인박스로).
        await Promise.all(
          designers.map((d) =>
            notifyDesigner(d.id, {
              title: "새 미배정 손님",
              body: summary.headline ?? "",
              url: designerInboxPath(d.staffToken),
            }),
          ),
        );
      }
    }

    return {
      consultationToken: consultation.consultationToken,
      designerToken: consultation.designerToken,
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
}

export async function getCustomerView(
  consultationToken: string,
): Promise<ConsultationView | null> {
  const repo = getRepo();
  const c = await repo.getByConsultationToken(consultationToken);
  if (!c) return null;
  const salon = await repo.getSalon(c.salonSlug);
  return {
    salon: salon ? toPublicSalon(salon) : null,
    // 손님 뷰는 phone 미반환(PII, P1-37). intake.phone 도 함께 제거.
    consultation: stripPhone(c),
    messages: await repo.listMessages(c.id),
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

  // 카르테에 등장한 serviceId 만 살롱 메뉴 라벨로(어드민 카르테와 동일 패턴). best-effort.
  const serviceLabelMap: Record<string, LocalizedText> = {};
  const neededIds = new Set<string>([
    ...(treatmentRecord?.serviceIds ?? []),
    ...customerTreatments.flatMap((t) => t.serviceIds),
  ]);
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
        source: "designer-view",
        message: "시술 라벨맵 조회 실패(라벨 생략)",
        detail: e instanceof Error ? e.message : String(e),
        consultationId: c.id,
      });
    }
  }

  return {
    salon: salon ? toPublicSalon(salon) : null,
    consultation: c,
    messages: await repo.listMessages(c.id),
    staffToken,
    treatmentRecord,
    customerTreatments,
    serviceLabelMap,
  };
}

/* ── 메시지 전송 (번역 포함) ───────────────────────────── */
async function buildTranslations(
  sourceText: string,
  sourceLocale: Locale,
  customerLocale: Locale,
): Promise<Partial<Record<Locale, string>>> {
  const ai = getAi();
  const out: Partial<Record<Locale, string>> = { [sourceLocale]: sourceText };
  const targets = new Set<Locale>(["ko", customerLocale]);
  targets.delete(sourceLocale);
  for (const to of targets) {
    out[to] = await ai.translate({
      text: sourceText,
      from: sourceLocale,
      to,
      domain: "salon",
    });
  }
  return out;
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
  if (!c) return null;

  // 레이트리밋 — 토큰+역할당 분당 메시지 상한(P0-10)
  await enforceRate(`msg:${input.role}:${input.token}`, 30, 60_000, {
    salonSlug: c.salonSlug,
    source: "translate",
    consultationId: c.id,
  });

  // 디자이너가 스레드에서 첫 메시지를 보내면 상담을 자동으로 진행중(in_service)으로.
  // intake/consulting 에서만 전이하므로 사실상 '첫 디자이너 메시지'에서 한 번만 동작한다.
  // (수동 '시술 시작' 트리거 제거 — Phase 2)
  const advanceToInService = async (): Promise<void> => {
    if (
      input.role === "designer" &&
      (c.status === "intake" || c.status === "consulting")
    ) {
      await repo.updateStatus(c.id, "in_service");
    }
  };

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
          [c.customerLocale]: subFor(
            c.customerLocale,
            qr.message[c.customerLocale],
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
        await advanceToInService();
        return msg;
      }
    }

    const text = (input.text ?? "").trim();
    if (!text) return null;
    const sourceLocale: Locale = input.role === "customer" ? c.customerLocale : "ko";
    const translations = await buildTranslations(
      text,
      sourceLocale,
      c.customerLocale,
    );
    const msg = await repo.addMessage({
      consultationId: c.id,
      sender: input.role,
      sourceText: text,
      sourceLocale,
      intent: input.intent,
      translations,
    });
    await advanceToInService();
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
  return repo.listMessages(c.id, input.sinceIso);
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

/* ── 시술 완료 → 리포트 발송 ───────────────────────────── */
export async function completeConsultation(input: {
  designerToken: string;
  record?: {
    products: string[];
    stateGrade?: ThreeLevel;
    /** 실제 캡처한 만족도/결과 점수(AI 추론값 아님) — 카르테에 영속. */
    satisfactionScore?: number;
  };
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}): Promise<{ reportToken: string } | null> {
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

  // before 소스 결정: 요약 단계에서 찍어둔 상담의 beforePhotoUrl 우선,
  // 없으면 리포트 폼 입력(input.beforePhotoUrl) 폴백. after 는 그대로 input.
  const beforeUrl = c.beforePhotoUrl ?? input.beforePhotoUrl;

  try {
    const salon = await repo.getSalon(c.salonSlug);
    const ai = getAi();
    const threadMessages = await repo.listMessages(c.id);
    const draft = await ai.draftReport({
      customerLocale: c.customerLocale,
      summary: c.summary,
      threadHighlightsKo: threadMessages
        .map((m) => m.translations.ko ?? m.sourceText)
        .slice(-8),
      record: input.record,
    });

    // products 라벨을 손님 로케일로(카탈로그 id → label[locale], 미스는 원문 유지, P1-18/27)
    const localizedProducts = localizeProducts(draft.products, c.customerLocale);

    // 리포트 보강(신규 optional) — 손님 요청 스타일/고민/주의를 요약에서, 없으면 인테이크 폴백.
    // 빈 문자열은 넣지 않는다(undefined 유지 → 리포트에서 해당 섹션 미노출).
    const styleRequest =
      c.summary.styleDetail?.trim() || c.intake.styleNote?.trim() || undefined;
    const concerns =
      c.summary.concerns?.trim() || c.intake.concernNote?.trim() || undefined;
    const cautions = c.summary.hairCautions?.trim() || undefined;

    const reportToken = c.reportToken ?? cryptoToken();
    const report: HairReport = {
      ...draft,
      products: localizedProducts,
      styleRequest,
      concerns,
      cautions,
      consultationId: c.id,
      reportToken,
      salonName: salon?.name ?? "소통 헤어",
      designerName: c.designerName ?? "담당 디자이너",
      date: new Date().toISOString(),
      beforePhotoUrl: beforeUrl,
      afterPhotoUrl: input.afterPhotoUrl,
      locale: c.customerLocale,
    };

    await repo.saveReport(report);
    await repo.setReportToken(c.id, reportToken);
    await repo.updateStatus(c.id, "completed");

    // 카르테(treatment_record) 영속 — 방문 1건을 customer 밑에 누적.
    // best-effort: 실패해도 이미 발송된 리포트를 망치지 않는다(try/catch + logIssue).
    try {
      await repo.createTreatmentRecord({
        consultationId: c.id,
        customerId: c.customerId,
        salonSlug: c.salonSlug,
        designerId: c.designerId,
        designerName: c.designerName,
        serviceIds: c.intake.serviceIds,
        products: input.record?.products ?? [],
        stateGrade: input.record?.stateGrade,
        satisfactionScore: input.record?.satisfactionScore,
        note: undefined,
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

    return { reportToken };
  } catch (e) {
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

export async function getReportView(
  reportToken: string,
): Promise<HairReport | null> {
  // 레이트리밋(P0) — 리포트 토큰당 분당 조회 상한(capability URL 스캔/폭주 방지).
  await enforceRate(`report:${reportToken}`, 60, 60_000, { source: "report" });
  return getRepo().getReport(reportToken);
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

/** 손님 대면 "다음 방문 권장" 문구 — 리포트의 nextVisitWeeks 표기(P1-18). */
export function nextVisitLabel(weeks: number, locale: Locale): string {
  return formatNextVisit(weeks, locale);
}

const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

/** 디자이너 기록 product(카탈로그 id 또는 자유 문자열)를 손님 로케일 라벨로. */
function localizeProducts(products: string[], locale: Locale): string[] {
  return products.map((p) => {
    const item = PRODUCT_MAP.get(p);
    return item ? (item.label[locale] ?? item.label.ko) : p;
  });
}

function cryptoToken(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
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
 * - verifyAdminKey 실패 → throw (무인증 전 지점 PII 노출 차단)
 * - salons → AdminSalon[] (entryToken/entryPath 서버 계산)
 * - consultations → ConsultationListItem[] (헤드라인/마스킹 폰/사진·PII 제외)
 */
export async function getAdminData(
  adminKey: string | undefined | null,
  salonSlug?: string,
): Promise<AdminViewData> {
  if (!verifyAdminKey(adminKey)) {
    await logIssue({
      salonSlug,
      severity: "warning",
      source: "admin",
      message: "어드민 인증 실패",
    });
    throw new Error("어드민 인증에 실패했습니다.");
  }
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
            entryPath: customerEntryPath(entryToken, "ja"),
            consultationCount: mine.length,
          };
          return adminDesigner;
        }),
      );
      return {
        ...s,
        salonEntryToken,
        salonEntryPath: customerEntryPath(salonEntryToken, "ja"),
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

/**
 * 미배정 상담을 디자이너에게 배정('내 손님으로 가져오기').
 * staffToken 으로 디자이너 검증 후, consultationToken(=designerToken) 으로 상담을 찾아 배정.
 */
export async function assignConsultation(
  staffToken: string,
  consultationToken: string,
): Promise<{ ok: boolean }> {
  const repo = getRepo();
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
  await repo.assignConsultation(c.id, { id: designer.id, name: designer.name });
  return { ok: true };
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
  salon: Salon;
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
    salon,
    designers,
    categories,
    services,
    consultations: consultations.map(toListItem),
    designerEntries: designers.map((d) => {
      const entryToken = makeDesignerEntryToken(d.id, d.entryKeyVersion);
      return {
        id: d.id,
        entryToken,
        entryPath: customerEntryPath(entryToken, "ja"),
        inboxPath: designerInboxPath(d.staffToken),
      };
    }),
    salonEntryToken,
    salonEntryPath: customerEntryPath(salonEntryToken, "ja"),
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
 *  - ranks 는 배열, 각 항목 {id?,label} 의 label 비어있지 않게.
 *  - 최종 id 는 소문자/숫자/하이픈으로 정규화(id 미지정 시 label 에서 생성).
 *  - 최종 id 중복 금지(중복이면 -2, -3 … 접미로 유일화).
 *  - 최소 0개 허용(전부 삭제 가능).
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

  // 정규화 + 검증(label 필수) + id 유일화.
  const seen = new Set<string>();
  const normalized: DesignerRank[] = [];
  for (const r of ranks) {
    const label = (r?.label ?? "").trim();
    if (!label) return { ok: false };
    const rawId = (r?.id ?? "").trim() || label;
    let id = normalizeRankId(rawId);
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    seen.add(id);
    normalized.push({ id, label });
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
}): Promise<{ ok: boolean; designer?: Designer }> {
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
    return { ok: true, designer: updated };
  }

  const designer = await repo.createDesigner({
    salonSlug: salon.slug,
    name,
    rankId,
  });
  return { ok: true, designer };
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
    entryPath: customerEntryPath(entryToken, "ja"),
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
    entryPath: customerEntryPath(entryToken, "ja"),
    version,
  };
}

/* ──────────────────────────────────────────────────────────────
 * 플랫폼 어드민 온보딩 (adminKey 권한) — 살롱/디자이너 생성.
 * ──────────────────────────────────────────────────────────────── */

/** 어드민 인증 게이트 — 실패 시 logIssue(warning) + throw. */
function ensureAdmin(adminKey: string | undefined | null): void {
  if (!verifyAdminKey(adminKey)) {
    throw new Error("어드민 인증에 실패했습니다.");
  }
}

export interface CreatedSalonResult {
  salon: Salon;
  consolePath: string; // /ko/s/{ownerToken}
  salonEntryToken: string;
  salonEntryPath: string;
}

/** 살롱 생성(어드민). ownerToken·콘솔 링크·공용 QR 토큰을 함께 반환. */
export async function adminCreateSalon(
  adminKey: string | undefined | null,
  input: {
    slug: string;
    name: string;
    address?: string;
  },
): Promise<CreatedSalonResult> {
  ensureAdmin(adminKey);
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

  const salonEntryToken = makeSalonEntryToken(salon.slug, salon.entryKeyVersion);
  return {
    salon,
    consolePath: salonConsolePath(salon.ownerToken),
    salonEntryToken,
    salonEntryPath: customerEntryPath(salonEntryToken, "ja"),
  };
}

export interface CreatedDesignerResult {
  designer: Designer;
  entryToken: string;
  entryPath: string;
  inboxPath: string;
}

/** 디자이너 생성(어드민). staffToken/QR/인박스 경로 반환(전달용). */
export async function adminCreateDesigner(
  adminKey: string | undefined | null,
  input: {
    salonSlug: string;
    name: string;
    rankId?: string;
  },
): Promise<CreatedDesignerResult> {
  ensureAdmin(adminKey);
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
  const entryToken = makeDesignerEntryToken(
    designer.id,
    designer.entryKeyVersion,
  );
  return {
    designer,
    entryToken,
    entryPath: customerEntryPath(entryToken, "ja"),
    inboxPath: designerInboxPath(designer.staffToken),
  };
}
