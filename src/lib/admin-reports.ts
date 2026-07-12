import "server-only";
import { getRepo } from "@/lib/db";
import type { Locale, ThreeLevel } from "@/lib/domain/types";

/**
 * 어드민 리포트 모음 — 전 살롱 발급 hair_reports 를 최신순으로.
 * 한 상담이 손님언어 리포트 + ko 디자이너 리포트(비-ko 손님) 2행을 낳을 수 있음 → locale 로 구분.
 */

export interface AdminReportRow {
  reportToken: string;
  consultationId: string;
  salonName: string;
  designerName: string;
  locale: Locale;
  date: string; // ISO
  hairStateScore: number;
  hairStateGrade: ThreeLevel;
  nextVisitWeeks: number;
  hasBeforePhoto: boolean;
  hasAfterPhoto: boolean;
}

export interface AdminReports {
  total: number;
  rows: AdminReportRow[];
}

export async function getAdminReports(opts?: {
  limit?: number;
}): Promise<AdminReports> {
  const reports = await getRepo().listReports({ limit: opts?.limit ?? 500 });
  const rows: AdminReportRow[] = reports.map((r) => ({
    reportToken: r.reportToken,
    consultationId: r.consultationId,
    salonName: r.salonName,
    designerName: r.designerName,
    locale: r.locale,
    date: r.date,
    hairStateScore: r.hairStateScore,
    hairStateGrade: r.hairStateGrade,
    nextVisitWeeks: r.nextVisitWeeks,
    hasBeforePhoto: !!r.beforePhotoUrl,
    hasAfterPhoto: !!r.afterPhotoUrl,
  }));
  return { total: rows.length, rows };
}
