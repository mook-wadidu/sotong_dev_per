import { config } from "@/lib/config";

/**
 * 공유/QR 용 절대 origin.
 *
 * 운영 정식 도메인(NEXT_PUBLIC_BASE_URL = config.baseUrl)이 설정돼 있으면 그것을 쓴다 —
 * 어드민이 보호된 Vercel 프리뷰(*.vercel.app)에서 QR/링크를 복사해도, 인코딩되는 URL은
 * 항상 공개 운영 도메인이 되어 받는 사람이 Vercel 로그인 벽에 막히지 않는다.
 * 미설정 시 요청 호스트로 폴백(LAN IP·localhost 등 dev 환경).
 */
export function shareOrigin(
  host: string | null | undefined,
  proto: string,
): string {
  // 1) 명시 설정(커스텀 도메인 등) 최우선.
  const base = config.baseUrl?.trim();
  if (base) return base.replace(/\/+$/, "");
  // 2) Vercel 운영 도메인 자동 — 어드민이 보호된 프리뷰(*.vercel.app, 랜덤 해시)에서
  //    링크를 복사해도, Vercel 이 주입하는 운영 도메인으로 나가 로그인 벽을 피한다.
  //    (VERCEL_URL 은 '현재 배포' URL이라 프리뷰면 그대로 보호됨 → 쓰지 않는다.)
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) {
    return `https://${prod.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }
  // 3) 요청 호스트 폴백(LAN/로컬 dev).
  return host ? `${proto}://${host}` : "";
}
