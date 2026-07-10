import "server-only";

import { getRepo } from "@/lib/db";
import type { Consultation } from "@/lib/domain/types";

/**
 * 보관/파기 정책 (PIPA 대응) — Phase 2.
 *
 * 배경: 동의문(customer.json intake.consent.*)이 "시술 후 일정 기간 뒤 파기"를
 * 약속한다. 약속을 지키려면 (1) 보관기간을 명시하고 (2) 기간 경과 건의 PII를
 * 실제로 파기/마스킹하는 잡이 있어야 한다. 이 모듈이 (1)(2)의 "선정·마스킹 로직"을
 * 담당한다. 실제 DB write(영속) 는 Repo 계층 책임이므로 scrub 포트로 주입받는다.
 *
 * ⚠️ 법무 검토 필요: 아래 보관기간/파기 대상은 MVP 초안 기본값이다.
 *    살롱 업종·계약·관련 법령(전자상거래법 보존의무 등)에 따라 조정해야 하며,
 *    배포 전 처리방침(docs/PRIVACY.md) 과 수치를 일치시켜야 한다.
 *
 * server-only: 클라이언트에서 import 금지. 크론/엣지 스케줄러나 어드민
 *    서버 액션 등 서버 컨텍스트에서만 호출한다.
 */

/* ── 보관기간 상수 ─────────────────────────────────────────── */

/** 하루(ms). 계산용. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 상담 완료/취소 후 PII(전화번호·사진 dataURL)를 보관하는 일수.
 * 이 기간이 지나면 cleanupExpiredPII 가 파기/마스킹 대상으로 선정한다.
 *
 * 90일 = 재방문·문의 대응을 위한 짧은 운영 보관 + 동의문의 "일정 기간" 의 현실적 상한.
 * (관광객 대상이라 장기 보관 실익이 낮다. 법무 검토로 조정 가능.)
 */
export const PII_RETENTION_DAYS = 90;

/**
 * 비식별 상담 레코드(요약·시술 종류 등 PII 제거 후 남는 통계성 데이터)의
 * 보관 일수. PII 파기 후에도 운영 통계용으로 더 길게 보관할 수 있다.
 * (현재 cleanup 은 PII 마스킹까지만 수행하고 레코드 자체는 남긴다 — 아래 주석 참고.)
 */
export const RECORD_RETENTION_DAYS = 365;

/** PII 파기 대상으로 보는 상담 상태 — 진행 중 건은 건드리지 않는다. */
export const TERMINAL_STATUSES = ["completed", "cancelled"] as const;

/* ── 파기 대상 선정 ────────────────────────────────────────── */

/**
 * 상담이 PII 파기 대상인지 판정.
 *
 * 주의: 도메인에 completedAt 필드가 없어 createdAt 을 기준점으로 쓴다.
 *   완료 시각이 아니라 "생성 후 N일" 이므로, 정확한 '시술 후 N일' 을 원하면
 *   Backend 가 completedAt(또는 statusChangedAt) 을 추가한 뒤 이 기준을 교체할 것.
 *   (보수적으로는 createdAt 기준이 더 일찍 파기 → 프라이버시에 유리.)
 */
export function isPiiExpired(
  c: Consultation,
  now: number = Date.now(),
  retentionDays: number = PII_RETENTION_DAYS,
): boolean {
  if (!TERMINAL_STATUSES.includes(c.status as (typeof TERMINAL_STATUSES)[number])) {
    return false;
  }
  const created = Date.parse(c.createdAt);
  if (Number.isNaN(created)) return false;
  return now - created > retentionDays * DAY_MS;
}

/** 상담에 파기 대상 PII 가 실제로 남아 있는지(이미 비워졌으면 skip). */
export function hasPii(c: Consultation): boolean {
  return Boolean(
    c.phone ||
      c.intake.phone ||
      c.beforePhotoUrl ||
      c.intake.selfiePhotoUrl ||
      (c.intake.stylePhotoUrls && c.intake.stylePhotoUrls.length > 0),
  );
}

/* ── 마스킹 (순수 함수) ────────────────────────────────────── */

/**
 * 상담에서 PII 를 제거/마스킹한 새 객체를 만든다(불변).
 * - phone / intake.phone: 완전 삭제
 * - intake.stylePhotoUrls / intake.selfiePhotoUrl / beforePhotoUrl: 사진 원본 dataURL 파기
 * - styleNote / concernNote / allergyNote: 자유 텍스트라 PII 우려 → 삭제
 *
 * 비PII(시술 종류·요약 등)는 운영 통계를 위해 남긴다. 요약(summary.raw) 에는
 * 가공된 정보가 들어갈 수 있으나 전화·사진 원본은 아니므로 여기서는 유지한다.
 *
 * 리포트(hair_reports)의 고객 PII(before/after 사진·style_request·concerns)는 이 도메인
 * 함수 밖 — repo.scrubConsultationPii 가 consultation_id 로 파기한다(리포트는 consultationId
 * 로만 매칭 가능해 도메인 Consultation 만으론 못 건드림). 선정은 reportsWithPii 가 담당.
 */
export function redactConsultationPii(c: Consultation): Consultation {
  return {
    ...c,
    phone: undefined,
    beforePhotoUrl: undefined, // 시술 전 사진(컬럼) 파기
    intake: {
      ...c.intake,
      phone: undefined,
      stylePhotoUrls: [],
      selfiePhotoUrl: undefined, // 손님 셀카 파기
      styleNote: undefined,
      concernNote: undefined,
      allergyNote: undefined,
    },
  };
}

/* ── cleanup 잡 ────────────────────────────────────────────── */

/**
 * PII 파기를 영속화하는 포트. cleanup 잡 호출자(크론/엣지/어드민 액션)가
 * 현재 드라이버에 맞는 구현을 주입한다.
 *
 * - memory 드라이버: 동일 store 의 consultation 객체를 redacted 로 교체.
 * - supabase 드라이버: UPDATE consultations SET phone=…, intake=… WHERE id=$1.
 *
 * 실제 mutator 는 Repo.scrubConsultationPii 로 구현돼 있다. 기본 scrubber
 * (repoScrubber)가 그걸 호출하므로, cleanup 잡은 선정·마스킹 후 곧바로 파기까지
 * 영속화한다. scrubber 를 생략하면 dry-run(선정만) 으로 안전하게 점검할 수 있다.
 */
export type PiiScrubber = (redacted: Consultation) => Promise<void>;

/** 현재 드라이버의 Repo.scrubConsultationPii 로 실제 파기를 영속화하는 기본 scrubber. */
export const repoScrubber: PiiScrubber = (redacted) =>
  getRepo().scrubConsultationPii(redacted);

export interface CleanupResult {
  /** 검사한 종료(completed/cancelled) 상담 수 */
  scanned: number;
  /** 보관기간이 지나 PII 가 남아 있던 대상 수 */
  expired: number;
  /** scrub 포트로 실제 파기 위임에 성공한 수 */
  redacted: number;
  /** scrub 중 실패한 상담 id (재시도 대상) */
  failures: string[];
}

export interface CleanupOptions {
  /** 특정 살롱만 처리(미지정 시 전체). */
  salonSlug?: string;
  /** 기준 시각(테스트용). 기본 Date.now(). */
  now?: number;
  /** 보관 일수 오버라이드(테스트/정책 변경용). 기본 PII_RETENTION_DAYS. */
  retentionDays?: number;
  /** 한 번 실행에서 처리할 최대 건수(부하 제어). 기본 500. */
  batchLimit?: number;
}

/**
 * 보관기간이 지난 완료/취소 상담의 PII 를 파기한다.
 *
 * 실제 연결: src/app/api/cron/retention/route.ts (Vercel Cron, vercel.json crons).
 * 그 라우트는 Authorization: Bearer <CRON_SECRET> 검증 후 아래처럼 호출한다:
 *
 *   import { cleanupExpiredPII, repoScrubber } from "@/lib/retention";
 *   const result = await cleanupExpiredPII(repoScrubber); // 실제 파기 영속화
 *
 * scrubber 를 생략하면 dry-run(선정만 하고 파기 위임 X) 으로 동작해
 * 어떤 건이 대상인지 안전하게 점검할 수 있다.
 */
export async function cleanupExpiredPII(
  scrub?: PiiScrubber,
  opts: CleanupOptions = {},
): Promise<CleanupResult> {
  const {
    salonSlug,
    now = Date.now(),
    retentionDays = PII_RETENTION_DAYS,
    batchLimit = 500,
  } = opts;

  const repo = getRepo();
  const all = await repo.listConsultations({ salonSlug, limit: batchLimit });
  const terminal = all.filter((c) =>
    TERMINAL_STATUSES.includes(
      c.status as (typeof TERMINAL_STATUSES)[number],
    ),
  );
  const expired = terminal.filter((c) => isPiiExpired(c, now, retentionDays));

  // 리포트(hair_reports)에 고객 PII 가 남은 상담 — consultation 이 이미 마스킹돼도
  // 리포트 사진/자유텍스트가 남으면 파기 대상(hasPii 는 consultation 필드만 봐서 놓친다).
  // 배치 1쿼리로 조회 → 선정에 반영.
  const reportPii = await repo.reportsWithPii(expired.map((c) => c.id));

  const result: CleanupResult = {
    scanned: terminal.length,
    expired: 0,
    redacted: 0,
    failures: [],
  };

  for (const c of expired) {
    // consultation PII 또는 리포트 PII 중 하나라도 남으면 파기(scrub 이 둘 다 처리).
    // 둘 다 비면 skip(이미 전부 파기됨) — 부분실패 시엔 남은 쪽이 잡혀 다음 런에 재시도된다.
    if (!hasPii(c) && !reportPii.has(c.id)) continue;
    result.expired += 1;
    if (!scrub) continue; // dry-run
    try {
      await scrub(redactConsultationPii(c));
      result.redacted += 1;
    } catch {
      result.failures.push(c.id);
    }
  }

  return result;
}
