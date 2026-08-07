import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import { cleanupExpiredPII, purgeByIds, repoScrubber } from "@/lib/retention";

/**
 * PII 파기 크론 (PIPA 보관/파기) — 보관기간 경과 완료/취소 상담의
 * 전화·사진·자유텍스트를 실제로 파기한다.
 *
 * 보호: config.cronSecret 미설정 시 전부 403(무인증 트리거 차단).
 *   Vercel Cron 은 `Authorization: Bearer <CRON_SECRET>` 헤더로 호출한다
 *   (CRON_SECRET env 설정 시). 수동 호출도 동일 헤더 필요.
 *
 * 스케줄: vercel.json 의 crons 항목(예: 매일 03:00 UTC)로 연결.
 */

// 항상 동적 — 캐시/정적화 금지(파기 잡).
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = config.cronSecret;
  if (!secret) return false; // 시크릿 미설정 = 차단(안전 기본값)
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // 길이 조기반환은 타이밍 오라클 → 양쪽을 고정 32B 다이제스트로 비교(entry.ts safeEqual 동형).
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function run(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  try {
    const result = await cleanupExpiredPII(repoScrubber);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cleanup failed" },
      { status: 500 },
    );
  }
}

/**
 * 삭제 요청 — id 를 지정해 **보관기간과 무관하게** 지금 파기한다.
 *
 *   curl -X POST .../api/cron/retention?mode=targeted \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"consultationIds":["..."],"customerIds":["..."]}'
 *
 * 이 id 는 **MAKEDOL 의 `scripts/purge-customer.mjs` 가 출력한다.** 소통에는 손님
 * 이메일 컬럼이 없어(device 단위 기록) 이메일로는 도달할 수 없고, MAKEDOL 의
 * `bookings.customer_id`/`consultation_id` 조인이 유일한 경로다.
 *
 * MAKEDOL 이 이 테이블에 직접 쓰지 않는 이유: 스키마 소유자가 소통이라 그렇게 하면
 * 소통 마이그레이션이 MAKEDOL 을 깨뜨리는 역방향 결합이 생긴다.
 *
 * ⚠️ 파기 자체는 크론과 **같은 코드**(`redactConsultationPii` + `scrubConsultationPii`)
 * 를 지난다. 대상 목록을 두 곳에 적으면 반드시 갈라진다 — 이 파일이 속한 모듈이
 * 이미 그걸로 한 번 데였다.
 */
async function runTargeted(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  let body: { consultationIds?: unknown; customerIds?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const ids = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const consultationIds = ids(body.consultationIds);
  const customerIds = ids(body.customerIds);
  if (consultationIds.length === 0 && customerIds.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }

  try {
    const result = await purgeByIds({ consultationIds, customerIds });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "purge failed" },
      { status: 500 },
    );
  }
}

// Vercel Cron 은 GET 으로 호출한다. 수동 트리거 호환을 위해 POST 도 허용.
export const GET = run;
export async function POST(req: Request): Promise<Response> {
  const mode = new URL(req.url).searchParams.get("mode");
  return mode === "targeted" ? runTargeted(req) : run(req);
}
