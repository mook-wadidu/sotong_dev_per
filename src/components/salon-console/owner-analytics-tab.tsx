"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { salonOwnerAnalytics } from "@/lib/actions";
import type { AdminAnalytics } from "@/lib/admin-analytics";

/**
 * 오너 분석 탭 — 내 살롱 스코프(salonOwnerAnalytics 재사용). 기간 7/30/90 전환.
 * KPI 중심 컴팩트 뷰 + 간단 분포 막대. 흑백.
 */
export function OwnerAnalyticsTab({ ownerToken }: { ownerToken: string }) {
  const t = useTranslations("Admin");
  const [range, setRange] = React.useState<7 | 30 | 90>(30);
  const [data, setData] = React.useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    // 기간 변경 시 로딩 표시(동기 리셋) — 데이터는 비동기 로드.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    salonOwnerAnalytics(ownerToken, range).then((d) => {
      if (alive) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [ownerToken, range]);

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const ranges: (7 | 30 | 90)[] = [7, 30, 90];

  const kpis = data
    ? [
        { label: t("analytics.kpi.consults"), value: data.totalConsults },
        {
          label: t("analytics.kpi.completionRate"),
          value: pct(data.completionRate),
        },
        {
          label: t("analytics.kpi.returningRate"),
          value: pct(data.returningRate),
        },
        {
          label: t("analytics.kpi.satisfaction"),
          value:
            data.avgSatisfaction != null
              ? data.avgSatisfaction.toFixed(1)
              : "—",
        },
        { label: t("analytics.kpi.reports"), value: data.reportsIssued },
        { label: t("analytics.kpi.scans"), value: data.scans },
      ]
    : [];

  const funnelRows = data
    ? data.funnel.map((f) => ({
        label: t(`analytics.funnel.${f.key}` as never),
        value: f.reached,
      }))
    : [];
  const localeRows = data
    ? data.byLocale.map((l) => ({ label: l.locale.toUpperCase(), count: l.count }))
    : [];
  const funnelMax = Math.max(1, ...funnelRows.map((r) => r.value));
  const localeMax = Math.max(1, ...localeRows.map((r) => r.count));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t("analytics.title")}</h3>
        <nav className="flex gap-2">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-current={r === range ? "true" : undefined}
              className={
                r === range
                  ? "inline-flex h-8 items-center rounded-lg bg-foreground px-3 text-xs font-medium text-background"
                  : "inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
              }
            >
              {t(`analytics.range${r}` as never)}
            </button>
          ))}
        </nav>
      </div>

      {loading || !data ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {loading ? "…" : t("analytics.empty")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-border bg-card p-4"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {k.label}
                </span>
                <p className="mt-1.5 text-2xl font-bold tabular-nums">
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-3 text-sm font-semibold">
              {t("analytics.funnel.title")}
            </h4>
            <Bars
              rows={funnelRows.map((r) => ({
                label: r.label,
                value: r.value,
                max: funnelMax,
              }))}
            />
          </section>

          {localeRows.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <h4 className="mb-3 text-sm font-semibold">
                {t("analytics.byLocale")}
              </h4>
              <Bars
                rows={localeRows.map((r) => ({
                  label: r.label,
                  value: r.count,
                  max: localeMax,
                }))}
              />
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 text-sm font-semibold">
              {t("analytics.notif.title")}
            </h4>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>
                {t("analytics.notif.sent")}{" "}
                <b className="text-foreground tabular-nums">
                  {data.notifications.sent}
                </b>
              </span>
              <span>
                {t("analytics.notif.failed")}{" "}
                <b className="text-foreground tabular-nums">
                  {data.notifications.failed}
                </b>
              </span>
              <span>
                {t("analytics.notif.noSub")}{" "}
                <b className="text-foreground tabular-nums">
                  {data.notifications.noSubscription}
                </b>
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Bars({
  rows,
}: {
  rows: { label: string; value: number; max: number }[];
}) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
            {r.label}
          </span>
          <span className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
            <span
              className="absolute inset-y-0 left-0 rounded bg-foreground"
              style={{ width: `${(r.value / r.max) * 100}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums">
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
