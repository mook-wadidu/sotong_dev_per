"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { reportPath, designerReportViewPath } from "@/lib/links";
import type { AdminReportRow } from "@/lib/admin-reports";
import type { Locale } from "@/lib/domain/types";

/**
 * 어드민 리포트 모음 — 전 살롱 발급 리포트 목록 + 즉시검색(살롱/디자이너명).
 * ko 행은 디자이너용 read-only 뷰(/d/r), 그 외는 손님 리포트(/c/r) 로 열람.
 * 흑백만.
 */
export function AdminReports({ rows }: { rows: AdminReportRow[] }) {
  const t = useTranslations("Admin");
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "ko";
  const localized = (href: string) =>
    href.replace(/^\/ko(?=\/|$|\?)/, `/${locale}`);

  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter(
        (r) =>
          r.salonName.toLowerCase().includes(needle) ||
          r.designerName.toLowerCase().includes(needle),
      )
    : rows;

  // ThreeLevel(high/mid/low) → 기존 stats.grade.* 라벨(상/중/하) 재사용.
  const gradeLabel = (g: string) => t(`stats.grade.${g}` as never);

  const viewHref = (r: AdminReportRow) =>
    r.locale === "ko"
      ? localized(designerReportViewPath(r.reportToken))
      : reportPath(r.reportToken, r.locale as Locale);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-tight">
            {t("reports.title")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("reports.hint")}
          </p>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("reports.search")}
          className="h-9 w-full max-w-xs rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-foreground sm:w-64"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t("reports.count", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {t("reports.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">
                  {t("reports.col.date")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("reports.col.salon")}
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
                <th className="px-3 py-2.5 text-right font-medium">
                  {t("reports.col.nextVisit")}
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
                  <td className="px-3 py-2.5 font-medium">{r.salonName}</td>
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
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {t("reports.weeks", { count: r.nextVisitWeeks })}
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
    </section>
  );
}
