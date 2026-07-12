import { getTranslations } from "next-intl/server";
import type { TrainingDataStatus } from "@/lib/admin-dataset";

/**
 * AI 학습 데이터셋 현황 — 건수·동의율·스키마·가명/파기 정책(학습 판단 근거).
 * 원본 미노출(집계만). 흑백.
 */
export async function AdminDataset({ data }: { data: TrainingDataStatus }) {
  const t = await getTranslations("Admin");
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  const kpis = [
    { label: t("dataset.kpi.samples"), value: data.sampleCount },
    { label: t("dataset.kpi.photos"), value: data.photo.total },
    { label: t("dataset.kpi.completed"), value: data.completedConsults },
  ];

  const consent = [
    {
      label: t("dataset.consent.training"),
      rate: data.trainingConsentRate,
      n: data.trainingConsented,
    },
    {
      label: t("dataset.consent.photo"),
      rate: data.photoConsentRate,
      n: data.photoConsented,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold leading-tight">
          {t("dataset.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("dataset.hint")}
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
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

      {/* 사진 종류별 */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="mb-2 text-sm font-semibold">
          {t("dataset.photo.title")}
        </h3>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            {t("dataset.photo.before")}{" "}
            <b className="text-foreground tabular-nums">{data.photo.before}</b>
          </span>
          <span>
            {t("dataset.photo.after")}{" "}
            <b className="text-foreground tabular-nums">{data.photo.after}</b>
          </span>
          <span>
            {t("dataset.photo.style")}{" "}
            <b className="text-foreground tabular-nums">{data.photo.style}</b>
          </span>
        </div>
      </section>

      {/* 동의율 */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">
          {t("dataset.consent.title")}
        </h3>
        <ul className="space-y-3">
          {consent.map((c) => (
            <li key={c.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">
                {c.label}
              </span>
              <span className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                <span
                  className="absolute inset-y-0 left-0 rounded bg-foreground"
                  style={{ width: pct(Math.min(1, c.rate)) }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">
                {pct(c.rate)}
                <span className="ml-1 text-muted-foreground">
                  ({c.n}/{data.completedConsults})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 스키마 + 제외 PII */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold">{t("dataset.schema.title")}</h3>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
            {t("dataset.schema.hint")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.featureFields.map((f) => (
              <code
                key={f}
                className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-xs"
              >
                {f}
              </code>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold">
            {t("dataset.excluded.title")}
          </h3>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
            {t("dataset.excluded.hint")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.excludedPii.map((f) => (
              <code
                key={f}
                className="rounded border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground line-through"
              >
                {f}
              </code>
            ))}
          </div>
        </section>
      </div>

      {/* 가명/파기 정책 + 학습 판단 */}
      <section className="rounded-xl border border-border bg-card p-4 text-sm sm:p-5">
        <h3 className="mb-2 text-sm font-semibold">{t("dataset.policy.title")}</h3>
        <dl className="space-y-2 text-muted-foreground">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-28 shrink-0 font-medium text-foreground">
              {t("dataset.policy.pseudonymLabel")}
            </dt>
            <dd className="font-mono text-xs">{data.pseudonymNote}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-28 shrink-0 font-medium text-foreground">
              {t("dataset.policy.retentionLabel")}
            </dt>
            <dd>{t("dataset.policy.retention")}</dd>
          </div>
        </dl>
        <p className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
          {t("dataset.policy.judgement")}
        </p>
      </section>
    </div>
  );
}
