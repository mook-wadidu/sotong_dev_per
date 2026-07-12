"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { salonOwnerDesigners } from "@/lib/actions";
import type { AdminDesignerStats } from "@/lib/admin-designers";

/**
 * 오너 디자이너 성과 탭 — 내 소속 디자이너 상담·완료율·재방문율·만족도·리포트 랭킹.
 * salonOwnerDesigners 재사용. 흑백 표.
 */
export function OwnerDesignersTab({ ownerToken }: { ownerToken: string }) {
  const t = useTranslations("Admin");
  const [rows, setRows] = React.useState<AdminDesignerStats[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    salonOwnerDesigners(ownerToken).then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [ownerToken]);

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  if (rows === null) {
    return <p className="py-10 text-center text-sm text-muted-foreground">…</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
        {t("designers.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">#</th>
            <th className="px-3 py-2.5 font-medium">
              {t("designers.col.designer")}
            </th>
            <th className="px-3 py-2.5 text-right font-medium">
              {t("designers.col.consults")}
            </th>
            <th className="px-3 py-2.5 text-right font-medium">
              {t("designers.col.completion")}
            </th>
            <th className="px-3 py-2.5 text-right font-medium">
              {t("designers.col.returning")}
            </th>
            <th className="px-3 py-2.5 text-right font-medium">
              {t("designers.col.satisfaction")}
            </th>
            <th className="px-3 py-2.5 text-right font-medium">
              {t("designers.col.reports")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.designerId}
              className={
                r.active
                  ? "border-b border-border last:border-0"
                  : "border-b border-border opacity-50 last:border-0"
              }
            >
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                {i + 1}
              </td>
              <td className="px-3 py-2.5 font-medium">{r.name}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{r.total}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {pct(r.completionRate)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {pct(r.returningRate)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {r.avgSatisfaction != null ? r.avgSatisfaction.toFixed(1) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {r.reports}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
