import "server-only";
import { getRepo } from "@/lib/db";

/**
 * 유입/조회 이벤트 기록(fire-and-forget) — 실패해도 화면에 영향 없음.
 * eventType: 'demo_view' | 'scan' | 'report_view' | 'admin_view' ...
 */
export async function trackEvent(
  eventType: string,
  opts?: { salonSlug?: string; locale?: string; actor?: string },
): Promise<void> {
  try {
    await getRepo().saveEvent({ eventType, ...opts });
  } catch {
    /* 트래킹 실패는 무시 */
  }
}
