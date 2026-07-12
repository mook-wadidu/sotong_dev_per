"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { salonOwnerReports } from "@/lib/actions";
import { reportPath, designerReportViewPath } from "@/lib/links";
import type { AdminReportRow } from "@/lib/admin-reports";
import type { Locale } from "@/lib/domain/types";

/**
 * 오너 리포트 탭 — 내 살롱 발급 리포트 목록 + 검색(디자이너명). ko 행은 디자이너 뷰,
 * 그 외는 손님 리포트로 열람. 흑백.
 */
export function OwnerReportsTab({ ownerToken }: { ownerToken: string }) {
  const t = useTranslations("Admin");
  const [rows, setRows] = React.useState<AdminReportRow[] | null>(null);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    salonOwnerReports(ownerToken).then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [ownerToken]);

  const gradeLabel = (g: string) => t(`stats.grade.${g}` as never);
  const viewHref = (r: AdminReportRow) =>
    r.locale === "ko"
      ? designerReportViewPath(r.reportToken)
      : reportPath(r.reportToken, r.locale as Locale);

  if (rows === null) {
    return <p className="py-10 text-center text-sm text-muted-foreground">…</p>;
  }

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) => r.designerName.toLowerCase().includes(needle))
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("reports.count", { count: filtered.length })}
        </p>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("reports.search")}
          className="h-9 w-full max-w-xs rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-foreground sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {t("reports.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">
                  {t("reports.col.date")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("reports.col.designer")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("reports.col.lang")}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {t("reports.col.score")}
                </th>
                <th className="px-3 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.reportToken}
                  className="border-b border-border last:border-0"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
                    {r.date.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2.5">{r.designerName}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-xs font-medium uppercase">
                      {r.locale}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    {r.hairStateScore}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {gradeLabel(r.hairStateGrade)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Link
                      href={viewHref(r)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {t("reports.view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
