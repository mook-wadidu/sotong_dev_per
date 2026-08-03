import { NextResponse } from "next/server";
import { markConsented } from "@/lib/service";

/**
 * 손님 [확인했어요] → customer_consented_at 기록 (B동의).
 *
 * 왜 서버액션이 아니라 route handler(fetch)인가:
 * 폴이 도는 customer-thread 에서 markConsented 를 **imperative 서버액션**으로 부르면
 * dispatch 가 서버에 안 닿아 무한 hang 했다(enter 로그조차 안 찍힘 — 진단 확정).
 * 같은 파일의 다른 액션(비폴 컴포넌트)은 정상. 평범한 HTTP POST 는 그 문제와 무관하다.
 */
export async function POST(request: Request): Promise<Response> {
  let token: unknown;
  try {
    ({ token } = await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof token !== "string" || token.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await markConsented(token);
  return NextResponse.json({ ok: true });
}
