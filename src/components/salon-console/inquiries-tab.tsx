"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DataTable, Badge, type Column } from "@/components/ui";
import { designerSummaryPath } from "@/lib/links";
import type { ConsultationListItem } from "@/lib/db/types";
import type { ConsultationStatus, Locale } from "@/lib/domain/types";

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

/**
 * 콘솔 문의/리포트 탭 — 자기 살롱 상담 목록(어드민 문의 탭과 동일 표).
 * 행 클릭 → 디자이너 요약 화면.
 */
export function ConsoleInquiriesTab({
  consultations,
}: {
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

  const columns: Column<ConsultationListItem>[] = [
    {
      header: t("inquiries.createdAt"),
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {formatDateTime(row.createdAt)}
        </span>
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
        <Badge variant={statusVariant(row.status)}>
          {statusLabel(row.status)}
        </Badge>
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
      columns={columns}
      rows={consultations}
      rowKey={(row) => row.id}
      onRowClick={(row) => router.push(designerSummaryPath(row.designerToken))}
      empty={t("empty.inquiries")}
      caption={t("inquiries.title")}
    />
  );
}
