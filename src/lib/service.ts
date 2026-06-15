import "server-only";
import { getRepo } from "@/lib/db";
import type {
  AdminDesigner,
  AdminSalon,
  ConsultationListItem,
  Designer,
  DesignerRank,
  ErrorLog,
  ErrorSeverity,
  Salon,
  SalonService,
  SalonServiceCategory,
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
import {
  NATIONALITY_BY_LOCALE,
  type Consultation,
  type HairReport,
  type IntakeDraft,
  type Locale,
  type Message,
  type QuickReplyIntent,
  type ThreeLevel,
  type TreatmentHistoryItem,
  type TreatmentRecency,
  type TreatmentType,
  type YesNoUnknown,
} from "@/lib/domain/types";

/* ── 레이트리밋 (인메모리 슬라이딩 윈도우) ─────────────────
 * QR 토큰/세션당 분당 상한으로 위조·어뷰즈 폭주를 차단(P0-10).
 * 단일 프로세스 한정(memory 드라이버와 동일 가정). supabase 전환 시 별도 보강 필요. */
const RATE_BUCKETS = new Map<string, number[]>();

class RateLimitError extends Error {
  constructor(msg = "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.") {
    super(msg);
    this.name = "RateLimitError";
  }
}

/** key 에 대해 windowMs 내 최대 max 회 허용. 초과 시 false. */
function rateAllow(key: string, max: number, windowMs: number): boolean {
  const nowMs = Date.now();
  const cutoff = nowMs - windowMs;
  const hits = (RATE_BUCKETS.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    RATE_BUCKETS.set(key, hits);
    return false;
  }
  hits.push(nowMs);
  RATE_BUCKETS.set(key, hits);
  // 가벼운 GC: 버킷이 너무 커지면 자른다.
  if (RATE_BUCKETS.size > 5000) RATE_BUCKETS.clear();
  return true;
}

async function enforceRate(
  key: string,
  max: number,
  windowMs: number,
  ctx: { salonSlug?: string; source: string; consultationId?: string },
): Promise<void> {
  if (rateAllow(key, max, windowMs)) return;
  await logIssue({
    salonSlug: ctx.salonSlug,
    severity: "warning",
    source: ctx.source,
    message: "레이트리밋 초과",
    detail: `key=${key} max=${max}/${windowMs}ms`,
    consultationId: ctx.consultationId,
  });
  throw new RateLimitError();
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

  try {
    const consultation = await repo.createConsultation({
      salonSlug,
      designerId,
      designerName,
      customerLocale: input.customerLocale,
      isReturning: input.isReturning,
      phone,
      intake: input.intake,
    });

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
      isReturning: input.isReturning,
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
      // 살롱 공용(미배정) → 그 살롱 디자이너 전원에게 미배정 손님 알림(인박스로).
      const designers = await repo.listDesigners(salonSlug);
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
  const resolved = await resolveEntry(entryToken, "C1");
  if (!resolved) return { salon: null };
  const salon = await getRepo().getSalon(resolved.salonSlug);
  if (!salon) return { salon: null };
  return { salon, designer: resolved.designer };
}

/* ── 손님/디자이너 뷰 ──────────────────────────────────── */
export interface ConsultationView {
  salon: Salon | null;
  consultation: Consultation;
  messages: Message[];
}

export async function getCustomerView(
  consultationToken: string,
): Promise<ConsultationView | null> {
  const repo = getRepo();
  const c = await repo.getByConsultationToken(consultationToken);
  if (!c) return null;
  return {
    salon: await repo.getSalon(c.salonSlug),
    // 손님 뷰는 phone 미반환(PII, P1-37). intake.phone 도 함께 제거.
    consultation: stripPhone(c),
    messages: await repo.listMessages(c.id),
  };
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
): Promise<ConsultationView | null> {
  const repo = getRepo();
  const c = await repo.getByDesignerToken(designerToken);
  if (!c) return null;
  return {
    salon: await repo.getSalon(c.salonSlug),
    consultation: c,
    messages: await repo.listMessages(c.id),
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
  const c =
    input.role === "customer"
      ? await repo.getByConsultationToken(input.token)
      : await repo.getByDesignerToken(input.token);
  if (!c) return [];
  return repo.listMessages(c.id, input.sinceIso);
}

/* ── 시술 완료 → 리포트 발송 ───────────────────────────── */
export async function completeConsultation(input: {
  designerToken: string;
  record?: { products: string[]; stateGrade?: ThreeLevel };
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}): Promise<{ reportToken: string } | null> {
  const repo = getRepo();
  const c = await repo.getByDesignerToken(input.designerToken);
  if (!c || !c.summary) return null;

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

    const reportToken = c.reportToken ?? cryptoToken();
    const report: HairReport = {
      ...draft,
      products: localizedProducts,
      consultationId: c.id,
      reportToken,
      salonName: salon?.name ?? "소통 헤어",
      designerName: c.designerName ?? "담당 디자이너",
      date: new Date().toISOString(),
      beforePhotoUrl: input.beforePhotoUrl,
      afterPhotoUrl: input.afterPhotoUrl,
      locale: c.customerLocale,
    };

    await repo.saveReport(report);
    await repo.setReportToken(c.id, reportToken);
    await repo.updateStatus(c.id, "completed");
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
  return getRepo().getReport(reportToken);
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
  salon: Salon;
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
    salon,
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
