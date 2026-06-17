"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DataTable,
  ListRow,
  Badge,
  type Column,
} from "@/components/ui";
import { designerSummaryPath } from "@/lib/links";
import type {
  AdminSalon,
  ConsultationListItem,
  ErrorLog,
  ErrorSeverity,
} from "@/lib/db/types";
import type { ConsultationStatus, Locale } from "@/lib/domain/types";

/** ko 데스크톱 날짜+시각 포맷 (formatDate 는 날짜만 → 목록엔 시각도 필요) */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const LOCALE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  ja: "日本語",
  en: "English",
};

/** 어드민 접수 내역 — 전역(지점 필터는 page.tsx 가 URL 로 유지). */
export function AdminInquiries({
  salons,
  consultations,
}: {
  salons: AdminSalon[];
  consultations: ConsultationListItem[];
}) {
  const t = useTranslations("Admin");
  const router = useRouter();

  const statusLabel = (s: ConsultationStatus): string => {
    switch (s) {
      case "intake":
        return t("inquiries.statusIntake");
      case "consulting":
        return t("inquiries.statusConsulting");
      case "in_service":
        return t("inquiries.statusInService");
      case "completed":
        return t("inquiries.statusCompleted");
      case "cancelled":
        return t("inquiries.statusCancelled");
      default:
        return s;
    }
  };

  const statusVariant = (
    s: ConsultationStatus,
  ): React.ComponentProps<typeof Badge>["variant"] => {
    switch (s) {
      case "intake":
        return "warning";
      case "consulting":
        return "info";
      case "in_service":
        return "accent";
      case "completed":
        return "success";
      case "cancelled":
        return "outline";
      default:
        return "default";
    }
  };

  const salonName = (slug: string): string =>
    salons.find((s) => s.slug === slug)?.name ?? slug;

  const inquiryColumns: Column<ConsultationListItem>[] = [
    {
      header: t("inquiries.createdAt"),
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      header: t("salonFilter"),
      cell: (row) => (
        <span className="whitespace-nowrap">{salonName(row.salonSlug)}</span>
      ),
    },
    {
      header: t("inquiries.designer"),
      cell: (row) => (
        <span className="whitespace-nowrap">
          {row.designerName ?? t("inquiries.unassigned")}
        </span>
      ),
    },
    {
      header: t("inquiries.locale"),
      cell: (row) => (
        <span className="whitespace-nowrap">
          {LOCALE_LABEL[row.customerLocale] ?? row.customerLocale}
        </span>
      ),
    },
    {
      header: t("inquiries.status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant={statusVariant(row.status)}>
            {statusLabel(row.status)}
          </Badge>
          {row.status === "completed" ? (
            <span className="whitespace-nowrap text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              {t("inquiries.openEmr")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: t("inquiries.headline"),
      cell: (row) => (
        <span className="line-clamp-2 text-foreground">{row.headline}</span>
      ),
      className: "max-w-[22rem]",
    },
    {
      header: t("inquiries.phone"),
      align: "right",
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {row.maskedPhone ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={inquiryColumns}
      rows={consultations}
      rowKey={(row) => row.id}
      onRowClick={(row) => router.push(designerSummaryPath(row.designerToken))}
      empty={t("empty.inquiries")}
      caption={t("inquiries.title")}
    />
  );
}

/** 어드민 오류 로그 — 전역(지점 필터는 page.tsx 가 URL 로 유지). */
export function AdminErrors({ errors }: { errors: ErrorLog[] }) {
  const t = useTranslations("Admin");

  const sevLabel = (sev: ErrorSeverity): string =>
    sev === "error"
      ? t("errors.sevError")
      : sev === "warning"
        ? t("errors.sevWarning")
        : t("errors.sevInfo");

  // 흑백: 색 대신 채움(error) / 연그레이 채움(warning) / 외곽선(info) + 텍스트 라벨.
  const sevVariant = (
    sev: ErrorSeverity,
  ): React.ComponentProps<typeof Badge>["variant"] =>
    sev === "error" ? "destructive" : sev === "warning" ? "default" : "outline";

  if (errors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
        {t("empty.errors")}
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {errors.map((e) => (
        <li key={e.id}>
          <ListRow
            leading={
              <Badge variant={sevVariant(e.severity)}>
                {sevLabel(e.severity)}
              </Badge>
            }
            title={e.message}
            subtitle={
              e.detail ? (
                <span className="line-clamp-1">{e.detail}</span>
              ) : (
                e.source
              )
            }
            trailing={
              <div className="flex flex-col items-end gap-0.5 text-right">
                <span className="whitespace-nowrap">{e.source}</span>
                <span className="whitespace-nowrap tabular-nums">
                  {formatDateTime(e.createdAt)}
                </span>
              </div>
            }
          />
        </li>
      ))}
    </ul>
  );
}
