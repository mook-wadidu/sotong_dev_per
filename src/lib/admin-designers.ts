import "server-only";
import { getRepo } from "@/lib/db";

/**
 * 어드민 전역 디자이너 성과 — 전 지점 디자이너 로스터 + 상담/완료/재방문/리포트 집계.
 * (활성 토글은 staff.is_active 배선 필요 — 후속.)
 */

export interface AdminDesignerStats {
  designerId: string;
  name: string;
  salonSlug: string;
  salonName: string;
  total: number;
  completed: number;
  completionRate: number; // 0~1
  returning: number;
  returningRate: number; // 0~1
  reports: number;
  avgSatisfaction: number | null; // 1~5, 값 있는 시술 평균
  active: boolean;
}

export async function getAdminDesigners(opts?: {
  /** 지정 시 해당 살롱만(오너 콘솔 스코프 — 전역 5000건 fetch 금지, F). */
  salonSlug?: string;
}): Promise<AdminDesignerStats[]> {
  const repo = getRepo();
  const [salons, consultations, treatments] = await Promise.all([
    opts?.salonSlug
      ? repo.getSalon(opts.salonSlug).then((s) => (s ? [s] : []))
      : repo.listSalons(),
    repo.listConsultations({ limit: 5000, salonSlug: opts?.salonSlug }),
    repo.listTreatmentsSince(new Date(0).toISOString()).catch(() => []),
  ]);
  const rosters = await Promise.all(
    salons.map((s) => repo.listDesigners(s.slug)),
  );
  const salonName = new Map(salons.map((s) => [s.slug, s.name]));

  // 디자이너별 만족도 누적(값 있는 시술만).
  const satMap = new Map<string, { sum: number; n: number }>();
  for (const tr of treatments) {
    if (!tr.designerId || typeof tr.satisfactionScore !== "number") continue;
    const s = satMap.get(tr.designerId) ?? { sum: 0, n: 0 };
    s.sum += tr.satisfactionScore;
    s.n += 1;
    satMap.set(tr.designerId, s);
  }

  type Acc = {
    designerId: string;
    name: string;
    salonSlug: string;
    salonName: string;
    active: boolean;
    total: number;
    completed: number;
    returning: number;
    reports: number;
  };
  const map = new Map<string, Acc>();

  // 로스터 초기화(상담 0건 디자이너도 목록에 포함).
  salons.forEach((s, i) => {
    for (const d of rosters[i]) {
      map.set(d.id, {
        designerId: d.id,
        name: d.name,
        salonSlug: s.slug,
        salonName: s.name,
        active: d.active ?? true,
        total: 0,
        completed: 0,
        returning: 0,
        reports: 0,
      });
    }
  });

  for (const c of consultations) {
    if (!c.designerId) continue; // 살롱 공용 QR 미배정 진입 제외
    let acc = map.get(c.designerId);
    if (!acc) {
      acc = {
        designerId: c.designerId,
        name: c.designerName ?? "—",
        salonSlug: c.salonSlug,
        salonName: salonName.get(c.salonSlug) ?? c.salonSlug,
        active: true,
        total: 0,
        completed: 0,
        returning: 0,
        reports: 0,
      };
      map.set(c.designerId, acc);
    }
    acc.total += 1;
    if (c.status === "completed") acc.completed += 1;
    if (c.isReturning) acc.returning += 1;
    if (c.reportToken) acc.reports += 1;
  }

  return [...map.values()]
    .map((a) => {
      const sat = satMap.get(a.designerId);
      return {
        ...a,
        completionRate: a.total ? a.completed / a.total : 0,
        returningRate: a.total ? a.returning / a.total : 0,
        avgSatisfaction: sat && sat.n ? sat.sum / sat.n : null,
      };
    })
    .sort((a, b) => b.total - a.total || b.completed - a.completed);
}
