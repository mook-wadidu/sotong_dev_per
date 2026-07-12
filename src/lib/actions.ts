"use server";

import {
  adminAddSupportNote as adminAddSupportNoteSvc,
  adminCreateAnnouncement as adminCreateAnnouncementSvc,
  adminCreateDesigner as adminCreateDesignerSvc,
  adminCreateSalon as adminCreateSalonSvc,
  adminListSupportNotes as adminListSupportNotesSvc,
  adminSetAnnouncementActive as adminSetAnnouncementActiveSvc,
  adminSetDesignerActive as adminSetDesignerActiveSvc,
  assignConsultation as assignConsultationSvc,
  completeConsultation,
  recordDesignerIntake as recordDesignerIntakeSvc,
  getAdminData as getAdminDataSvc,
  getConsultationStatus as getConsultationStatusSvc,
  getDesignerInbox as getDesignerInboxSvc,
  getIntakeMenu as getIntakeMenuSvc,
  getCustomerHistory as getCustomerHistorySvc,
  getMessagesSince,
  getReturningContext as getReturningContextSvc,
  getSalonConsole as getSalonConsoleSvc,
  getSalonInfo,
  getSalonInfoByEntry,
  postMessage,
  saveSatisfactionRating as saveSatisfactionRatingSvc,
  saveBeforePhoto as saveBeforePhotoSvc,
  saveDesignerPush,
  startService as startServiceSvc,
  rotateSalonEntryKey as rotateSalonEntryKeySvc,
  rotateDesignerEntryKey as rotateDesignerEntryKeySvc,
  rotateDesignerStaffToken as rotateDesignerStaffTokenSvc,
  rotateOwnerToken as rotateOwnerTokenSvc,
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
  ConsultationStatus,
  Customer,
  CustomerHairProfile,
  DesignerHairInput,
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
  type Announcement,
  type ConsultationListItem,
  type Designer,
  type DesignerRank,
  type NewAnnouncement,
  type SupportNote,
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
    // 손님에게 "이름 + 직급"을 보여주려면 rankId 를 salon.designerRanks 라벨로 풀어 채운다.
    // PublicSalon 은 designerRanks 를 strip 하므로 라벨은 PublicDesigner.rankLabel 로만 전달.
    designer: designer
      ? toPublicDesigner(designer, salon?.designerRanks)
      : undefined,
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

/* ── 손님: 리포트에서 시술 만족도 별점 저장(1~5) ───────────── */
export async function saveSatisfactionRating(
  reportToken: string,
  score: number,
): Promise<{ ok: boolean }> {
  return saveSatisfactionRatingSvc(reportToken, score);
}

/* ── 손님: 상담 상태 폴링 (완료 + 리포트 도착 감지) ─────────── */
export async function getConsultationStatus(
  consultationToken: string,
): Promise<{ status: ConsultationStatus; reportToken?: string } | null> {
  return getConsultationStatusSvc(consultationToken);
}

/* ── 디자이너: 시술 시작(명시) → in_service 전이 ───────────── */
export async function startService(
  designerToken: string,
): Promise<{ ok: boolean }> {
  return startServiceSvc(designerToken);
}

/* ── 디자이너: 시술 완료 → 리포트 발송 (+카르테 영속) ───────── */
export async function finishAndSendReport(input: {
  designerToken: string;
  record?: {
    products: string[];
    stateGrade?: ThreeLevel;
    /** 실제 캡처한 만족도/결과 점수(AI 추론값 아님) — 카르테에 영속 */
    satisfactionScore?: number;
    /** 디자이너가 실제로 한 시술(살롱 메뉴 id) — 없으면 손님 분류 폴백(태그 구분). */
    serviceIds?: string[];
  };
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}) {
  return completeConsultation(input);
}

/* ── 디자이너: 신체정보 입력(요약 '디자이너 입력' 카드) ───────── */
export async function recordDesignerIntake(
  designerToken: string,
  fields: DesignerHairInput,
): Promise<{ ok: boolean }> {
  return recordDesignerIntakeSvc(designerToken, fields);
}

/* ── 디자이너: 시술 전 사진 저장 (요약 단계 촬영 → 상담건에 보존) ───── */
export async function saveBeforePhoto(
  designerToken: string,
  dataUrl: string,
): Promise<{ ok: boolean }> {
  return saveBeforePhotoSvc(designerToken, dataUrl);
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
  salonSlug?: string,
): Promise<AdminData> {
  return getAdminDataSvc(salonSlug);
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

/** 디자이너 인박스 토큰(staff_token) 재발급 — 인박스 링크 유출 대응(옛 링크 무효). */
export async function rotateDesignerStaffToken(input: {
  ownerToken: string;
  designerId: string;
}): Promise<{ ok: boolean; staffToken?: string; inboxPath?: string }> {
  return rotateDesignerStaffTokenSvc(input);
}

/** 오너 콘솔 토큰 회전 — 새 랜덤 ownerToken 발급(기존 콘솔 링크 무효화). */
export async function rotateOwnerToken(
  ownerToken: string,
): Promise<{ ok: boolean; ownerToken?: string; consolePath?: string }> {
  return rotateOwnerTokenSvc(ownerToken);
}

/* ── 플랫폼 어드민: 살롱/디자이너 생성 (세션 쿠키 검증) ──── */
export async function adminCreateSalon(
  input: { slug: string; name: string; address?: string },
): Promise<{ ok: true; result: CreatedSalonResult } | { ok: false; error: string }> {
  try {
    const result = await adminCreateSalonSvc(input);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "생성 실패" };
  }
}

export async function adminCreateDesigner(
  input: { salonSlug: string; name: string; rankId?: string },
): Promise<
  { ok: true; result: CreatedDesignerResult } | { ok: false; error: string }
> {
  try {
    const result = await adminCreateDesignerSvc(input);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "생성 실패" };
  }
}

export async function createAnnouncement(
  input: NewAnnouncement,
): Promise<
  { ok: true; result: Announcement } | { ok: false; error: string }
> {
  try {
    const result = await adminCreateAnnouncementSvc(input);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "생성 실패" };
  }
}

export async function setAnnouncementActive(
  id: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await adminSetAnnouncementActiveSvc(id, active);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "변경 실패" };
  }
}

export async function setDesignerActive(
  designerId: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await adminSetDesignerActiveSvc(designerId, active);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "변경 실패" };
  }
}

export async function listSupportNotes(
  consultationId: string,
): Promise<
  { ok: true; notes: SupportNote[] } | { ok: false; error: string }
> {
  try {
    const notes = await adminListSupportNotesSvc(consultationId);
    return { ok: true, notes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "조회 실패" };
  }
}

export async function addSupportNote(input: {
  consultationId: string;
  body: string;
}): Promise<{ ok: true; note: SupportNote } | { ok: false; error: string }> {
  try {
    const note = await adminAddSupportNoteSvc(input);
    return { ok: true, note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장 실패" };
  }
}
