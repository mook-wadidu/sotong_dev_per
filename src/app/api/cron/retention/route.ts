import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import { cleanupExpiredPII, repoScrubber } from "@/lib/retention";

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

// Vercel Cron 은 GET 으로 호출한다. 수동 트리거 호환을 위해 POST 도 허용.
export const GET = run;
export const POST = run;
