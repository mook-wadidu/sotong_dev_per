"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Badge, Card, CardContent } from "@/components/ui";
import { serviceLabels } from "@/lib/catalog";
import type {
  Locale,
  LocalizedText,
  ThreeLevel,
  TreatmentRecord,
} from "@/lib/domain/types";

const INTL_LOCALE: Record<Locale, string> = {
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
  zh: "zh-CN",
};

function formatVisitedAt(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * 회원별 시술 이력 타임라인(카르테). 방문(treatment_record) 1건 = 카드 1장.
 * visitedAt desc 순(service.listCustomerTreatments 가 최신순으로 돌려준다).
 * serviceIds 는 전역 카탈로그 라벨로(미스는 raw id 폴백), products 는 원문 표기.
 * 흑백 디자인: 만족도는 색/별 대신 Badge + "{score}점" 텍스트로.
 */
export function CustomerHistory({
  locale,
  treatments,
  serviceLabelMap,
}: {
  locale: Locale;
  treatments: TreatmentRecord[];
  /** 살롱 메뉴 id → 다국어 라벨(살롱-프리픽스 serviceId 해석용). 전역 카탈로그보다 우선. */
  serviceLabelMap?: Record<string, LocalizedText>;
}) {
  const t = useTranslations("Admin");

  const gradeLabel = (g?: ThreeLevel): string | undefined => {
    if (!g) return undefined;
    return t(`console.customers.grade.${g}`);
  };

  if (treatments.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
        {t("console.customers.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">
        {t("console.customers.visitCount", { count: treatments.length })}
      </p>
      <ol className="space-y-3">
        {treatments.map((rec, i) => {
          // serviceId 는 `${salonSlug}:${catalogId}` 형식 → 살롱 라벨맵을 우선 사용,
          // 없으면 전역 카탈로그, 그래도 없으면 raw id 폴백.
          const services = rec.serviceIds.map((id) => {
            const loc = serviceLabelMap?.[id];
            if (loc) return loc[locale] ?? loc.ko;
            return serviceLabels([id], locale)[0] ?? id;
          });
          const grade = gradeLabel(rec.stateGrade);
          return (
            <li key={rec.id}>
              <Card>
                <CardContent className="space-y-3 p-4">
                  {/* 방문 헤더 — 방문 회차 + 날짜 + 담당 */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="accent">
                        {t("console.customers.visit")}{" "}
                        {treatments.length - i}
                      </Badge>
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {formatVisitedAt(rec.visitedAt, locale)}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {rec.designerName ?? t("console.customers.unassigned")}
                    </Badge>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <Row label={t("console.customers.services")}>
                      {services.length
                        ? services.join(", ")
                        : t("console.customers.none")}
                    </Row>
                    <Row label={t("console.customers.products")}>
                      {rec.products.length
                        ? rec.products.join(", ")
                        : t("console.customers.none")}
                    </Row>
                    <Row label={t("console.customers.stateGrade")}>
                      {grade ?? t("console.customers.none")}
                    </Row>
                    <Row label={t("console.customers.satisfaction")}>
                      {typeof rec.satisfactionScore === "number" ? (
                        <Badge variant="success">
                          {t("console.customers.satisfactionScore", {
                            score: rec.satisfactionScore,
                          })}
                        </Badge>
                      ) : (
                        t("console.customers.none")
                      )}
                    </Row>
                  </dl>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-foreground">{children}</dd>
    </div>
  );
}
