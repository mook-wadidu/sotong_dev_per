import { getTranslations } from "next-intl/server";
import type { AdminDesignerStats } from "@/lib/admin-designers";
import { DesignerActiveToggle } from "@/components/admin/designer-active-toggle";

/**
 * 전역 디자이너 성과 랭킹 — 상담·완료율·재방문율·리포트. 흑백 표.
 */
export async function AdminDesigners({
  rows,
}: {
  rows: AdminDesignerStats[];
}) {
  const t = await getTranslations("Admin");
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  if (rows.length === 0) {
    return (
      <section className="space-y-3">
        <Header t={t} />
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {t("designers.empty")}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Header t={t} />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">
                {t("designers.col.designer")}
              </th>
              <th className="px-3 py-2.5 font-medium">
                {t("designers.col.salon")}
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
              <th className="px-3 py-2.5 text-right font-medium">
                {t("designers.col.status")}
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
                <td className="px-3 py-2.5 text-muted-foreground">
                  {r.salonName}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.total}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {pct(r.completionRate)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({r.completed})
                  </span>
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
                <td className="px-3 py-2.5 text-right">
                  <DesignerActiveToggle
                    designerId={r.designerId}
                    active={r.active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Header({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <div>
      <h2 className="text-base font-semibold leading-tight">
        {t("designers.title")}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {t("designers.hint")}
      </p>
    </div>
  );
}
