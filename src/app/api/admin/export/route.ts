import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { getAdminReports } from "@/lib/admin-reports";

/**
 * 어드민 CSV 내보내기 — `?type=reports`. 어드민 세션(구글/공유키) 게이트.
 * Excel 한글 깨짐 방지 UTF-8 BOM. 현재 reports 지원(추후 consultations 등 확장).
 */
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  let s = String(v ?? "");
  // 수식 인젝션 방어 — Excel/Sheets 가 =,+,-,@,탭,CR 로 시작하는 셀을 수식으로 실행.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authed = (await getAdminUser()) || (await readAdminSession());
  if (!authed) return new NextResponse("forbidden", { status: 403 });

  const type = req.nextUrl.searchParams.get("type") ?? "reports";
  if (type !== "reports") {
    return new NextResponse("unknown type", { status: 400 });
  }

  const { rows } = await getAdminReports({ limit: 5000 });
  const header = [
    "date",
    "salon",
    "designer",
    "locale",
    "hairScore",
    "grade",
    "nextVisitWeeks",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date.slice(0, 10),
        r.salonName,
        r.designerName,
        r.locale,
        r.hairStateScore,
        r.hairStateGrade,
        r.nextVisitWeeks,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const csv = "﻿" + lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="sotong-reports.csv"',
    },
  });
}
