"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ConsultationListItem } from "@/lib/db/types";

/**
 * 오너 회원/고객 탭 — 이미 로드된 consultations에서 식별 고객(customerId)을 그룹핑.
 * 방문 횟수·최근 방문·언어. 각 회원은 기존 고객 상세 라우트로 이동. 흑백.
 */
export function OwnerMembersTab({
  ownerToken,
  consultations,
}: {
  ownerToken: string;
  consultations: ConsultationListItem[];
}) {
  const t = useTranslations("Admin");
  const [q, setQ] = React.useState("");

  const members = React.useMemo(() => {
    const map = new Map<
      string,
      {
        customerId: string;
        visits: number;
        lastVisit: string;
        locale: string;
        headline: string;
        maskedPhone?: string;
      }
    >();
    for (const c of consultations) {
      if (!c.customerId) continue;
      const m = map.get(c.customerId);
      if (!m) {
        map.set(c.customerId, {
          customerId: c.customerId,
          visits: 1,
          lastVisit: c.createdAt,
          locale: c.customerLocale,
          headline: c.headline,
          maskedPhone: c.maskedPhone,
        });
      } else {
        m.visits += 1;
        if (c.createdAt > m.lastVisit) {
          m.lastVisit = c.createdAt;
          m.headline = c.headline;
        }
      }
    }
    return [...map.values()].sort((a, b) =>
      a.lastVisit < b.lastVisit ? 1 : -1,
    );
  }, [consultations]);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? members.filter(
        (m) =>
          (m.maskedPhone ?? "").includes(needle) ||
          m.headline.toLowerCase().includes(needle),
      )
    : members;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("members.count", { count: filtered.length })}
        </p>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("members.search")}
          className="h-9 w-full max-w-xs rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-foreground sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {t("members.empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.customerId}>
              <Link
                href={`/ko/s/${ownerToken}/customers/${m.customerId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {m.maskedPhone ?? m.headline}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {t("members.visits", { count: m.visits })} ·{" "}
                    {m.lastVisit.slice(0, 10)} · {m.locale.toUpperCase()}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
