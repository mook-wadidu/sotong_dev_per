import "server-only";
import webpush from "web-push";
import { config } from "@/lib/config";

/**
 * 웹푸시(VAPID) 발송 — 디자이너 PWA 알림.
 * VAPID 키(public/private/subject)가 모두 있으면 모듈 로드 시 1회 setVapidDetails.
 * 키가 비면 푸시는 no-op(앱은 정상 동작). 발송 실패는 throw 하지 않고 결과 객체로 돌려준다.
 */
const PUSH_ENABLED = Boolean(
  config.vapidPublicKey && config.vapidPrivateKey && config.vapidSubject,
);

if (PUSH_ENABLED) {
  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey,
  );
}

/**
 * 단일 구독에 푸시 발송.
 * - 성공: { ok: true, gone: false }
 * - 만료/폐기 구독(404/410): { ok: false, gone: true } — 호출부가 구독을 삭제한다.
 * - 그 외 에러: { ok: false, gone: false }
 * - 키 없음(no-op): { ok: false, gone: false }
 * 절대 throw 하지 않는다(메인 플로우 보호).
 */
export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; gone: boolean }> {
  if (!PUSH_ENABLED) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true, gone: false };
  } catch (e) {
    const statusCode = (e as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, gone: true };
    }
    return { ok: false, gone: false };
  }
}
