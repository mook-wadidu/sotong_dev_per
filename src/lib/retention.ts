import "server-only";

import { getRepo } from "@/lib/db";
import type { Consultation, IntakeDraft } from "@/lib/domain/types";

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
  // 상태 무관 — 방치된 non-terminal(intake/consulting/in_service)도 retention 지나면 파기.
  // 상담은 방문 1회(수 시간)라 age > retention 이면 완료됐거나 방치된 것(정상 진행 아님).
  // 기존엔 terminal-only 게이트라 대다수 레코드의 PII 가 영영 안 지워지던 결함(A5).
  const created = Date.parse(c.createdAt);
  if (Number.isNaN(created)) return false;
  return now - created > retentionDays * DAY_MS;
}

/* ── 인테이크 필드 분류 (단일 출처) ──────────────────────────
 *
 * `IntakeDraft` 의 **모든** 필드를 「지움/보존」 중 하나로 분류한다.
 * `hasPii()`(선정)와 `redactConsultationPii()`(마스킹)가 **같은 이 맵을 본다.**
 *
 * ## 왜 맵인가 — 두 함수가 실제로 어긋나 있었다
 *
 * 예전엔 두 함수가 각자 필드를 나열했고, `hasPii` 는 전화·사진만 봤다. 그래서
 * `styleNote`·`concernNote`·`allergyNote` 만 남은 상담은 **선정 자체가 안 돼**
 * redact 가 지우도록 돼 있는 값이 영원히 남았다. 목록이 둘이면 반드시 갈라진다.
 *
 * ## 왜 `Record<keyof IntakeDraft, …>` 인가
 *
 * `IntakeDraft` 에 필드를 하나 더하면 **여기 분류를 안 적는 한 `tsc` 가 깨진다.**
 * 파기는 "명시한 것만 지운다" 는 위험한 기본값 위에 서 있었다 — 새 필드는 조용히
 * 보존됐고, 실제로 `name`(손님 이름)이 그렇게 파기를 통과하고 있었다.
 * 열거로 메우지 말고 **다음 사람이 반드시 판단하게** 만든다.
 *
 * ⚠️ 이 맵은 `consultations` 안만 덮는다. 알레르기 **서사**는 `hair_reports.cautions`
 * 에 쌓이고 그건 `repo.scrubConsultationPii` 가 따로 지운다.
 */
type IntakeDisposition = "clear" | "keep";

const INTAKE_PII: Record<keyof IntakeDraft, IntakeDisposition> = {
  /* 직접 식별자 */
  phone: "clear",
  name: "clear", // 손님 이름. 같은 파일이 trainingConsentedAt 주석에서 스스로 PII 로 분류한다

  /* 사진 — 원본 dataURL */
  stylePhotoUrls: "clear",
  selfiePhotoUrl: "clear", // 얼굴 = 생체정보

  /* 자유 텍스트 — 무엇이 적힐지 통제할 수 없다 */
  styleNote: "clear",
  concernNote: "clear",
  allergyNote: "clear",

  /* 건강정보(PIPA §23). allergyNote 만 지우고 boolean 을 남기면
     "이 사람은 알레르기가 있다" 가 그대로 남는다 — 그 자체가 민감정보다. */
  allergy: "clear",

  /* 동의 증거 — 지우면 "동의를 받았다" 를 증명할 수 없다. 파기 대상이 아니다. */
  consentedAt: "keep",
  age14ConfirmedAt: "keep",
  sensitiveConsentedAt: "keep",
  trainingConsentedAt: "keep",
  photoTrainingConsentedAt: "keep",

  /* 통계·운영용 비식별 값. summary 가 nationality 를 통계로 유지하는 것과 같은 기준. */
  contactOptOut: "keep",
  age: "keep",
  gender: "keep",
  nationality: "keep",
  serviceCategoryIds: "keep",
  serviceIds: "keep",
  desiredColor: "keep",
  faceShape: "keep",
  crownVolume: "keep",
  hairDensity: "keep",
  hairType: "keep",
  cowlickWhorl: "keep",
  cowlickSticking: "keep",
  treatmentHistory: "keep",
  concernIds: "keep",
};

const INTAKE_CLEAR_KEYS = (
  Object.keys(INTAKE_PII) as (keyof IntakeDraft)[]
).filter((k) => INTAKE_PII[k] === "clear");

/** 값이 실제로 남아 있는가(빈 배열·빈 문자열은 없는 것으로 본다). */
function present(v: unknown): boolean {
  if (v === undefined || v === null || v === false) return false;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** 상담에 파기 대상 PII 가 실제로 남아 있는지(이미 비워졌으면 skip). */
export function hasPii(c: Consultation): boolean {
  if (present(c.phone) || present(c.beforePhotoUrl)) return true;
  return INTAKE_CLEAR_KEYS.some((k) => present(c.intake[k]));
}

/* ── 마스킹 (순수 함수) ────────────────────────────────────── */

/**
 * 상담에서 PII 를 제거/마스킹한 새 객체를 만든다(불변).
 * - phone / intake.phone: 완전 삭제
 * - intake.stylePhotoUrls / intake.selfiePhotoUrl / beforePhotoUrl: 사진 원본 dataURL 파기
 * - styleNote / concernNote / allergyNote: 자유 텍스트라 PII 우려 → 삭제
 *
 * summary 는 **자유텍스트 파생분만** 지운다: hairCautions(알레르기=건강정보가 여기 모인다),
 * styleDetail·concerns(손님 자유텍스트의 번역본), raw(전문). 원문을 지우면서 그 번역본을
 * 영구 보존하면 파기가 무의미하고, 건강정보가 무기한 남는다(§23). 통계용 비PII
 * (headline·nationality·services·estimatedPrice)는 유지.
 *
 * 리포트(hair_reports)의 고객 PII(before/after 사진·style_request·concerns·cautions)는 이 도메인
 * 함수 밖 — repo.scrubConsultationPii 가 consultation_id 로 파기한다(리포트는 consultationId
 * 로만 매칭 가능해 도메인 Consultation 만으론 못 건드림). 선정은 reportsWithPii 가 담당.
 * 대화(messages)도 동일하게 scrubConsultationPii 가 비운다.
 */
function clearIntakePii(intake: IntakeDraft): IntakeDraft {
  const out: IntakeDraft = { ...intake };
  for (const k of INTAKE_CLEAR_KEYS) {
    // 배열 필드는 undefined 가 아니라 빈 배열이어야 타입이 유지된다.
    (out[k] as unknown) = Array.isArray(intake[k]) ? [] : undefined;
  }
  return out;
}

export function redactConsultationPii(c: Consultation): Consultation {
  return {
    ...c,
    phone: undefined,
    beforePhotoUrl: undefined, // 시술 전 사진(컬럼) 파기
    // 분류 맵이 단일 출처다. 여기 필드를 손으로 나열하지 않는다 —
    // 그렇게 해서 hasPii 와 갈라졌었다.
    intake: clearIntakePii(c.intake),
    // AI 요약의 자유텍스트 파생분 파기(건강정보 포함) — 원문만 지우고 번역본을 남기면 무의미.
    summary: c.summary
      ? {
          ...c.summary,
          hairCautions: "",
          styleDetail: "",
          concerns: "",
          raw: "",
        }
      : c.summary,
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
  const before = new Date(now - retentionDays * DAY_MS).toISOString();
  const result: CleanupResult = {
    scanned: 0,
    expired: 0,
    redacted: 0,
    failures: [],
  };

  // 오래된순·미파기(pii_purged_at IS NULL)건만 배치로 집어 drain.
  // 마커 덕에 scrub 한 건은 재선정 안 됨 → 배치가 비면 종료. 단일 런 상한(부하 제어)은 MAX_BATCHES.
  const MAX_BATCHES = scrub ? 50 : 1; // dry-run 은 1배치만(마킹 없어 무한루프 방지).
  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = await repo.listConsultationsForPurge({
      before,
      limit: batchLimit,
      salonSlug,
    });
    if (batch.length === 0) break;
    result.scanned += batch.length;

    // 리포트 PII 잔존 여부(consultation 이 마스킹돼도 리포트가 남을 수 있음).
    const reportPii = await repo.reportsWithPii(batch.map((c) => c.id));

    for (const c of batch) {
      const hadPii = hasPii(c) || reportPii.has(c.id);
      if (hadPii) result.expired += 1;
      if (!scrub) continue; // dry-run — 선정만
      try {
        // PII 없어도 scrub 호출(마커를 남겨 재선정 중단). redact 는 멱등.
        await scrub(redactConsultationPii(c));
        if (hadPii) result.redacted += 1;
      } catch {
        result.failures.push(c.id);
      }
    }
    if (batch.length < batchLimit) break; // 마지막 배치
  }

  // customer_hair_profiles 자유텍스트 파기 — 방문마다 INSERT 되며 위 경로가 못 건드리던 PII.
  if (scrub) {
    try {
      result.redacted += await repo.scrubExpiredHairProfiles(before);
    } catch {
      // best-effort — 다음 런 재시도.
    }
    // customers.phone 파기 — 상담 파기 경로가 못 건드리던 **유일한 잔존 전화번호 사본**.
    // 이게 없어서 동의문의 "방문 90일 후 연락처 파기" 가 사실이 아니었다.
    try {
      result.redacted += await repo.scrubExpiredCustomers(before);
    } catch {
      // best-effort — 다음 런 재시도.
    }
  }

  return result;
}
