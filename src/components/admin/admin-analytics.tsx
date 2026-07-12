import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { adminPath } from "@/lib/links";
import type { AdminAnalytics } from "@/lib/admin-analytics";

/**
 * 어드민 분석 대시보드 — 전부 흑백 인라인 SVG(차트 라이브러리 없음).
 * KPI 타일 + 일자별 추이(상담·완료·데모조회) + 퍼널 + 언어/지점 분포.
 * 기간 탭(7/30/90)은 URL `range` 파라미터로 서버 재조회.
 */

const localizeHref = (href: string, locale: string) =>
  href.replace(/^\/ko(?=\/|$|\?)/, `/${locale}`);

const pct = (n: number) => `${Math.round(n * 100)}%`;

export async function AdminAnalyticsView({
  data,
  locale,
  salon,
}: {
  data: AdminAnalytics;
  locale: string;
  salon?: string;
}) {
  const t = await getTranslations("Admin");

  const ranges: { value: 7 | 30 | 90; label: string }[] = [
    { value: 7, label: t("analytics.range7") },
    { value: 30, label: t("analytics.range30") },
    { value: 90, label: t("analytics.range90") },
  ];

  const kpis = [
    { label: t("analytics.kpi.demoViews"), value: data.demoViews },
    { label: t("analytics.kpi.consults"), value: data.totalConsults },
    {
      label: t("analytics.kpi.completionRate"),
      value: pct(data.completionRate),
    },
    {
      label: t("analytics.kpi.returningRate"),
      value: pct(data.returningRate),
    },
    { label: t("analytics.kpi.reports"), value: data.reportsIssued },
    {
      label: t("analytics.kpi.satisfaction"),
      value:
        data.avgSatisfaction != null
          ? data.avgSatisfaction.toFixed(1)
          : "—",
    },
  ];

  const funnelRows = data.funnel.map((f) => ({
    label: t(`analytics.funnel.${f.key}` as never),
    value: f.reached,
  }));

  const localeRows = data.byLocale.map((l) => ({
    label: l.locale.toUpperCase(),
    value: l.count,
  }));

  const salonRows = data.bySalon.map((s) => ({
    label: s.salonSlug,
    value: s.consults,
  }));

  return (
    <div className="space-y-6">
      {/* 기간 탭 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-tight">
            {t("analytics.title")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("analytics.hint")}
          </p>
        </div>
        <nav aria-label={t("analytics.rangeLabel")} className="flex gap-2">
          {ranges.map((r) => {
            const active = r.value === data.range;
            return (
              <Link
                key={r.value}
                href={localizeHref(
                  `${adminPath({ view: "analytics", salon })}${
                    adminPath({ view: "analytics", salon }).includes("?")
                      ? "&"
                      : "?"
                  }range=${r.value}`,
                  locale,
                )}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "inline-flex h-9 items-center rounded-lg bg-foreground px-3.5 text-sm font-medium text-background"
                    : "inline-flex h-9 items-center rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                }
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* KPI 타일 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <span className="text-xs font-medium text-muted-foreground">
              {k.label}
            </span>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* 일자별 추이 */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-4">
          <h3 className="text-sm font-semibold">{t("analytics.trend.title")}</h3>
          <Legend
            items={[
              { label: t("analytics.trend.consults"), fill: "var(--foreground)" },
              {
                label: t("analytics.trend.completed"),
                fill: "var(--muted-foreground)",
              },
            ]}
          />
        </div>
        <GroupedBars
          data={data.byDay}
          emptyLabel={t("analytics.empty")}
        />
        <div className="mt-4 mb-2 flex items-center gap-4">
          <h3 className="text-sm font-semibold">
            {t("analytics.trend.demoTitle")}
          </h3>
        </div>
        <DemoBars data={data.byDay} emptyLabel={t("analytics.empty")} />
      </section>

      {/* 퍼널 + 분포 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold">
            {t("analytics.funnel.title")}
          </h3>
          <HBars rows={funnelRows} emptyLabel={t("analytics.empty")} />
        </section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold">
            {t("analytics.byLocale")}
          </h3>
          <HBars rows={localeRows} emptyLabel={t("analytics.empty")} />
        </section>
      </div>

      {!salon && salonRows.length > 1 ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold">
            {t("analytics.bySalon")}
          </h3>
          <HBars rows={salonRows} emptyLabel={t("analytics.empty")} />
        </section>
      ) : null}
    </div>
  );
}

/* ── 흑백 SVG 차트 프리미티브 ─────────────────────────────── */

function Legend({ items }: { items: { label: string; fill: string }[] }) {
  return (
    <div className="flex items-center gap-3">
      {items.map((it) => (
        <span
          key={it.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: it.fill }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** 일자별 그룹 막대(상담 = 진한, 완료 = 회색 오버레이). */
function GroupedBars({
  data,
  emptyLabel,
}: {
  data: AdminAnalytics["byDay"];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.consults));
  if (data.every((d) => d.consults === 0)) return <Empty label={emptyLabel} />;
  const W = 720;
  const H = 140;
  const gap = 2;
  const bw = Math.max(1, (W - gap * (data.length - 1)) / data.length);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      preserveAspectRatio="none"
      role="img"
    >
      {data.map((d, i) => {
        const x = i * (bw + gap);
        const h = (d.consults / max) * H;
        const hc = (d.completed / max) * H;
        return (
          <g key={d.day}>
            <rect
              x={x}
              y={H - h}
              width={bw}
              height={h}
              fill="var(--foreground)"
            />
            <rect
              x={x}
              y={H - hc}
              width={bw}
              height={hc}
              fill="var(--muted-foreground)"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** 데모 조회수 일자별(테두리 막대). */
function DemoBars({
  data,
  emptyLabel,
}: {
  data: AdminAnalytics["byDay"];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.demoViews));
  if (data.every((d) => d.demoViews === 0)) return <Empty label={emptyLabel} />;
  const W = 720;
  const H = 100;
  const gap = 2;
  const bw = Math.max(1, (W - gap * (data.length - 1)) / data.length);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      preserveAspectRatio="none"
      role="img"
    >
      {data.map((d, i) => {
        const x = i * (bw + gap);
        const h = (d.demoViews / max) * H;
        return (
          <rect
            key={d.day}
            x={x}
            y={H - h}
            width={bw}
            height={h}
            fill="var(--foreground)"
          />
        );
      })}
    </svg>
  );
}

/** 라벨 있는 가로 막대(퍼널·분포 공용). */
function HBars({
  rows,
  emptyLabel,
}: {
  rows: { label: string; value: number }[];
  emptyLabel: string;
}) {
  if (rows.length === 0 || rows.every((r) => r.value === 0))
    return <Empty label={emptyLabel} />;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
            {r.label}
          </span>
          <span className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
            <span
              className="absolute inset-y-0 left-0 rounded bg-foreground"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums">
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
