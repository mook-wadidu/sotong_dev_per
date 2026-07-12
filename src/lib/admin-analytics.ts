import "server-only";
import { getRepo } from "@/lib/db";
import type { ConsultationStatus } from "@/lib/domain/types";

/**
 * 어드민 분석 집계 — 기간 내 상담(status·locale·재방문·리포트) + 이벤트(demo_view)를
 * 앱단에서 일자 버킷팅. 파일럿 규모용(스케일 시 group-by RPC 로 이전).
 */

const DAY_MS = 86_400_000;

export type AnalyticsRange = 7 | 30 | 90;

export interface AdminAnalytics {
  range: number;
  totalConsults: number;
  completed: number;
  completionRate: number; // 0~1
  returningRate: number; // 0~1
  reportsIssued: number;
  avgSatisfaction: number | null; // 1~5
  demoViews: number;
  byDay: {
    day: string; // YYYY-MM-DD
    consults: number;
    completed: number;
    demoViews: number;
  }[];
  funnel: { key: ConsultationStatus; reached: number }[]; // 누적 퍼널
  byLocale: { locale: string; count: number }[];
  bySalon: { salonSlug: string; consults: number; completed: number }[];
}

export async function getAdminAnalytics(opts: {
  range: AnalyticsRange;
  salonSlug?: string;
}): Promise<AdminAnalytics> {
  const repo = getRepo();
  const now = Date.now();
  const sinceIso = new Date(now - opts.range * DAY_MS).toISOString();

  const [consultations, events] = await Promise.all([
    repo.listConsultations({ salonSlug: opts.salonSlug, limit: 5000 }),
    // analytics_events 미적용(migration 0014) 상태에서도 대시보드가 죽지 않도록 방어 —
    // 실패 시 이벤트 0(데모 조회수만 비고, 상담 지표는 유지).
    repo.listEventsSince(sinceIso).catch(() => []),
  ]);

  const inRange = consultations.filter((c) => c.createdAt >= sinceIso);

  // 일자 버킷 초기화(연속된 날짜).
  const days: string[] = [];
  for (let i = opts.range - 1; i >= 0; i--) {
    days.push(new Date(now - i * DAY_MS).toISOString().slice(0, 10));
  }
  const dayMap = new Map(
    days.map((d) => [d, { day: d, consults: 0, completed: 0, demoViews: 0 }]),
  );

  for (const c of inRange) {
    const b = dayMap.get(c.createdAt.slice(0, 10));
    if (b) {
      b.consults += 1;
      if (c.status === "completed") b.completed += 1;
    }
  }

  const demoEvents = events.filter(
    (e) =>
      e.eventType === "demo_view" &&
      (!opts.salonSlug || e.salonSlug === opts.salonSlug),
  );
  for (const e of demoEvents) {
    const b = dayMap.get(e.createdAt.slice(0, 10));
    if (b) b.demoViews += 1;
  }

  const total = inRange.length;
  const completed = inRange.filter((c) => c.status === "completed").length;
  const returning = inRange.filter((c) => c.isReturning).length;
  const reports = inRange.filter((c) => !!c.reportToken).length;

  // 누적 퍼널: intake(전체) → consulting → in_service → completed.
  const reachedFrom = (min: number) => {
    const rank: Record<ConsultationStatus, number> = {
      intake: 0,
      consulting: 1,
      in_service: 2,
      completed: 3,
      cancelled: -1,
    };
    return inRange.filter((c) => rank[c.status] >= min).length;
  };
  const funnel: AdminAnalytics["funnel"] = [
    { key: "intake", reached: total },
    { key: "consulting", reached: reachedFrom(1) },
    { key: "in_service", reached: reachedFrom(2) },
    { key: "completed", reached: reachedFrom(3) },
  ];

  const localeMap = new Map<string, number>();
  for (const c of inRange)
    localeMap.set(c.customerLocale, (localeMap.get(c.customerLocale) ?? 0) + 1);
  const byLocale = [...localeMap.entries()]
    .map(([locale, count]) => ({ locale, count }))
    .sort((a, b) => b.count - a.count);

  const salonMap = new Map<string, { consults: number; completed: number }>();
  for (const c of inRange) {
    const s = salonMap.get(c.salonSlug) ?? { consults: 0, completed: 0 };
    s.consults += 1;
    if (c.status === "completed") s.completed += 1;
    salonMap.set(c.salonSlug, s);
  }
  const bySalon = [...salonMap.entries()]
    .map(([salonSlug, v]) => ({ salonSlug, ...v }))
    .sort((a, b) => b.consults - a.consults);

  // 만족도는 treatment_records 집계 필요 — 다음 서브빌드에서 전역 시술 조회 메서드로 연결.
  const avgSatisfaction: number | null = null;

  return {
    range: opts.range,
    totalConsults: total,
    completed,
    completionRate: total ? completed / total : 0,
    returningRate: total ? returning / total : 0,
    reportsIssued: reports,
    avgSatisfaction,
    demoViews: demoEvents.length,
    byDay: days.map((d) => dayMap.get(d)!),
    funnel,
    byLocale,
    bySalon,
  };
}
