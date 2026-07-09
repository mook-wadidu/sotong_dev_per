import { getTranslations } from "next-intl/server";
import type { QrTrafficData } from "@/lib/service";

/**
 * QR/홍보 유입 뷰 — 총합 + 일자별 막대(KST). 개발자·팀원만(어드민 키 게이트 안).
 * 리플렛 QR(순수 /demo 직접진입) 방문만 집계된다(홈 클릭·프리페치 제외).
 */
export async function AdminTraffic({ data }: { data: QrTrafficData }) {
  const t = await getTranslations("Admin");
  const { total, daily, sinceDays } = data;
  const max = daily.reduce((m, d) => Math.max(m, d.count), 0);

  // 최근이 위로 오도록 역순 표시.
  const rows = [...daily].reverse();

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-semibold leading-tight">
          {t("traffic.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("traffic.hint", { days: sinceDays })}
        </p>
      </div>

      {/* 총합 타일 */}
      <div className="rounded-xl border border-border bg-card p-5">
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">
          {t("traffic.total")}
        </span>
        <p className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl">
          {total.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("traffic.totalHint")}
        </p>
      </div>

      {/* 일자별 */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t("traffic.daily")}</h3>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
            {t("traffic.empty")}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((d) => (
              <li
                key={d.date}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5"
              >
                <span className="w-24 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {d.date}
                </span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{
                      width: `${max ? Math.max(4, (d.count / max) * 100) : 0}%`,
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {d.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
