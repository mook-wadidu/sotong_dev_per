"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
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
  zh: "中文",
};

/**
 * 콘솔 문의/리포트 탭 — 자기 살롱 상담 목록(어드민 문의 탭과 동일 표).
 * 행 클릭 → 디자이너 요약 화면.
 */
export function ConsoleInquiriesTab({
  consultations,
  ownerToken,
}: {
  consultations: ConsultationListItem[];
  /** 회원 카르테 링크(/{locale}/s/{ownerToken}/customers/{customerId}) 생성용 */
  ownerToken: string;
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
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
    {
      // 회원 카르테 — 기기 토큰으로 식별된 손님이면 시술 이력으로 진입(행 클릭과 분리).
      header: t("inquiries.customer"),
      align: "right",
      cell: (row) =>
        row.customerId ? (
          <button
            type="button"
            className="whitespace-nowrap font-medium text-foreground underline underline-offset-4 hover:no-underline"
            onClick={(e) => {
              e.stopPropagation();
              router.push(
                `/${locale}/s/${ownerToken}/customers/${row.customerId}`,
              );
            }}
          >
            {t("inquiries.view")}
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
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
