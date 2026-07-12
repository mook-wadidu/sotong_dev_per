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
}

export async function getAdminDesigners(): Promise<AdminDesignerStats[]> {
  const repo = getRepo();
  const [salons, consultations] = await Promise.all([
    repo.listSalons(),
    repo.listConsultations({ limit: 5000 }),
  ]);
  const rosters = await Promise.all(
    salons.map((s) => repo.listDesigners(s.slug)),
  );
  const salonName = new Map(salons.map((s) => [s.slug, s.name]));

  type Acc = {
    designerId: string;
    name: string;
    salonSlug: string;
    salonName: string;
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
    .map((a) => ({
      ...a,
      completionRate: a.total ? a.completed / a.total : 0,
      returningRate: a.total ? a.returning / a.total : 0,
    }))
    .sort((a, b) => b.total - a.total || b.completed - a.completed);
}
