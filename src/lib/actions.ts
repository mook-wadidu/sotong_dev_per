"use server";

import {
  adminCreateDesigner as adminCreateDesignerSvc,
  adminCreateSalon as adminCreateSalonSvc,
  assignConsultation as assignConsultationSvc,
  completeConsultation,
  getAdminData as getAdminDataSvc,
  getDesignerInbox as getDesignerInboxSvc,
  getIntakeMenu as getIntakeMenuSvc,
  getCustomerHistory as getCustomerHistorySvc,
  getMessagesSince,
  getReturningContext as getReturningContextSvc,
  getSalonConsole as getSalonConsoleSvc,
  getSalonInfo,
  getSalonInfoByEntry,
  postMessage,
  saveDesignerPush,
  rotateSalonEntryKey as rotateSalonEntryKeySvc,
  rotateDesignerEntryKey as rotateDesignerEntryKeySvc,
  salonDeleteService as salonDeleteServiceSvc,
  salonUpdateRanks as salonUpdateRanksSvc,
  salonUpsertCategory as salonUpsertCategorySvc,
  salonUpsertDesigner as salonUpsertDesignerSvc,
  salonUpsertService as salonUpsertServiceSvc,
  startConsultation,
  logIssue,
  type AdminViewData,
  type CreatedDesignerResult,
  type CreatedSalonResult,
  type IntakeMenu,
  type SalonConsoleData,
} from "@/lib/service";
import type {
  Customer,
  CustomerHairProfile,
  IntakeDraft,
  Locale,
  LocalizedText,
  Message,
  QuickReplyIntent,
  ThreeLevel,
  TreatmentRecord,
} from "@/lib/domain/types";
import {
  toPublicSalon,
  toPublicDesigner,
  type ConsultationListItem,
  type Designer,
  type DesignerRank,
  type PublicDesigner,
  type PublicSalon,
  type SalonService,
  type SalonServiceCategory,
} from "@/lib/db/types";

/* ── 살롱 공개 정보 (클라 도달 — 비밀 제거 투영) ─────────── */
export async function getSalon(slug: string): Promise<PublicSalon | null> {
  const salon = await getSalonInfo(slug);
  return salon ? toPublicSalon(salon) : null;
}

/* ── 살롱 공개 정보 (C1 진입 — 입장 토큰 검증 후, 비밀 제거 투영) ── */
export async function getSalonByEntry(
  entryToken: string,
): Promise<{ salon: PublicSalon | null; designer?: PublicDesigner }> {
  const { salon, designer } = await getSalonInfoByEntry(entryToken);
  return {
    salon: salon ? toPublicSalon(salon) : null,
    designer: designer ? toPublicDesigner(designer) : undefined,
  };
}

/* ── 손님: 인테이크 메뉴 (살롱별 편집 카탈로그, 입장 토큰 검증 후) ── */
export async function getIntakeMenu(
  entryToken: string,
): Promise<IntakeMenu | null> {
  return getIntakeMenuSvc(entryToken);
}

/* ── 손님: 인테이크 제출 (입장 토큰만 신뢰, salonSlug 미수신) ── */
export async function submitIntake(input: {
  entryToken: string;
  customerLocale: Locale;
  isReturning: boolean;
  intake: IntakeDraft;
}) {
  return startConsultation(input);
}

/* ── 스레드: 메시지 전송 / 폴링 ────────────────────────── */
export async function sendMessage(input: {
  token: string;
  role: "customer" | "designer";
  text?: string;
  intent?: QuickReplyIntent;
  replyId?: string;
  value?: string;
}): Promise<Message | null> {
  return postMessage(input);
}

export async function pollMessages(input: {
  token: string;
  role: "customer" | "designer";
  sinceIso?: string;
}): Promise<Message[]> {
  return getMessagesSince(input);
}

/* ── 디자이너: 시술 완료 → 리포트 발송 (+카르테 영속) ───────── */
export async function finishAndSendReport(input: {
  designerToken: string;
  record?: {
    products: string[];
    stateGrade?: ThreeLevel;
    /** 실제 캡처한 만족도/결과 점수(AI 추론값 아님) — 카르테에 영속 */
    satisfactionScore?: number;
  };
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}) {
  return completeConsultation(input);
}

/* ── 손님: 재방문 프리필 컨텍스트 (입장 토큰 검증 후, 쿠키 읽기 전용) ──
 * 서버컴포넌트에서 직접 호출해도 되지만, 클라 폴백용 thin wrapper 도 노출한다. */
export async function getReturningContext(entryToken: string): Promise<{
  isReturning: boolean;
  profile?: CustomerHairProfile;
  lastServiceIds?: string[];
  lastVisitedAt?: string;
} | null> {
  return getReturningContextSvc(entryToken);
}

/* ── 사장: 회원별 시술 이력 (ownerToken 검증, 살롱 스코프 강제) ── */
export async function getCustomerHistory(
  ownerToken: string,
  customerId: string,
): Promise<{ customer: Customer; treatments: TreatmentRecord[] } | null> {
  return getCustomerHistorySvc(ownerToken, customerId);
}

/* ── 디자이너: 개인 인박스 (디자이너 staffToken) ─────────── */
export async function getDesignerInbox(staffToken: string): Promise<{
  designer: Designer;
  salon: PublicSalon;
  mine: ConsultationListItem[];
  unassigned: ConsultationListItem[];
} | null> {
  return getDesignerInboxSvc(staffToken);
}

/* ── 디자이너: 웹푸시 구독 저장 (PWA 알림 켜기) ──────────── */
export async function savePushSubscription(
  staffToken: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<{ ok: boolean }> {
  return saveDesignerPush(staffToken, subscription);
}

/* ── 디자이너: 미배정 상담 '내 손님으로 가져오기' ─────────── */
export async function assignConsultation(
  staffToken: string,
  consultationToken: string,
): Promise<{ ok: boolean }> {
  return assignConsultationSvc(staffToken, consultationToken);
}

/* ── 어드민: 지점·문의·에러 한 번에 (인증 필수) ─────────── */
export type AdminData = AdminViewData;

export async function getAdminData(
  adminKey: string | undefined | null,
  salonSlug?: string,
): Promise<AdminData> {
  return getAdminDataSvc(adminKey, salonSlug);
}

/* ── 클라이언트 에러 리포트 (에러 바운더리에서 호출) ───── */
export async function reportClientError(input: {
  salonSlug?: string;
  message: string;
  detail?: string;
  source?: string;
}): Promise<void> {
  await logIssue({
    salonSlug: input.salonSlug,
    severity: "error",
    source: input.source ?? "client",
    message: input.message,
    detail: input.detail,
  });
}

/* ── 살롱 콘솔: 초기 데이터 (ownerToken 검증) ───────────── */
export type SalonConsole = SalonConsoleData;

export async function getSalonConsole(
  ownerToken: string,
): Promise<SalonConsole | null> {
  return getSalonConsoleSvc(ownerToken);
}

/* ── 살롱 콘솔: 메뉴 편집 (ownerToken 검증, 서버에서 살롱 스코프 강제) ── */
export async function salonUpsertCategory(input: {
  ownerToken: string;
  id?: string;
  label: LocalizedText;
  sort?: number;
}): Promise<{ ok: boolean; category?: SalonServiceCategory }> {
  return salonUpsertCategorySvc(input);
}

export async function salonUpsertService(input: {
  ownerToken: string;
  id?: string;
  categoryId: string;
  label: LocalizedText;
  basePriceFrom: number;
  rankPrices?: Record<string, number>;
  active?: boolean;
}): Promise<{ ok: boolean; service?: SalonService }> {
  return salonUpsertServiceSvc(input);
}

export async function salonDeleteService(input: {
  ownerToken: string;
  id: string;
}): Promise<{ ok: boolean }> {
  return salonDeleteServiceSvc(input);
}

/* ── 살롱 콘솔: 디자이너 편집 (ownerToken 검증) ─────────── */
export async function salonUpsertDesigner(input: {
  ownerToken: string;
  id?: string;
  name: string;
  rankId?: string;
}): Promise<{ ok: boolean; designer?: Designer }> {
  return salonUpsertDesignerSvc(input);
}

/* ── 살롱 콘솔: 직급(rank) 편집 (ownerToken 검증) ────────── */
export async function salonUpdateRanks(
  ownerToken: string,
  ranks: DesignerRank[],
): Promise<{ ok: boolean }> {
  return salonUpdateRanksSvc(ownerToken, ranks);
}

/* ── 살롱 콘솔: QR 재발급(키 회전, ownerToken 검증) ───────── */
export async function rotateSalonEntryKey(
  ownerToken: string,
): Promise<{ ok: boolean; entryToken?: string; entryPath?: string; version?: number }> {
  return rotateSalonEntryKeySvc(ownerToken);
}

export async function rotateDesignerEntryKey(input: {
  ownerToken: string;
  designerId: string;
}): Promise<{ ok: boolean; entryToken?: string; entryPath?: string; version?: number }> {
  return rotateDesignerEntryKeySvc(input);
}

/* ── 플랫폼 어드민: 살롱/디자이너 생성 (adminKey 검증) ──── */
export async function adminCreateSalon(
  adminKey: string | undefined | null,
  input: { slug: string; name: string; address?: string },
): Promise<{ ok: true; result: CreatedSalonResult } | { ok: false; error: string }> {
  try {
    const result = await adminCreateSalonSvc(adminKey, input);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "생성 실패" };
  }
}

export async function adminCreateDesigner(
  adminKey: string | undefined | null,
  input: { salonSlug: string; name: string; rankId?: string },
): Promise<
  { ok: true; result: CreatedDesignerResult } | { ok: false; error: string }
> {
  try {
    const result = await adminCreateDesignerSvc(adminKey, input);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "생성 실패" };
  }
}
