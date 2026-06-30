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
  const base = config.baseUrl?.trim();
  if (base) return base.replace(/\/+$/, "");
  return host ? `${proto}://${host}` : "";
}
