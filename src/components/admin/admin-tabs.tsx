"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  DataTable,
  ListRow,
  Badge,
  type Column,
} from "@/components/ui";
import { SalonQR } from "@/components/admin/salon-qr";
import { Onboarding } from "@/components/admin/onboarding";
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

export function AdminTabs({
  adminKey,
  origin,
  salons,
  consultations,
  errors,
}: {
  adminKey: string;
  origin: string;
  salons: AdminSalon[];
  consultations: ConsultationListItem[];
  errors: ErrorLog[];
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

  const sevLabel = (sev: ErrorSeverity): string =>
    sev === "error"
      ? t("errors.sevError")
      : sev === "warning"
        ? t("errors.sevWarning")
        : t("errors.sevInfo");

  // Phase 3 흑백: 색 대신 채움(error) / 연그레이 채움(warning) / 외곽선(info) + 텍스트 라벨.
  const sevVariant = (
    sev: ErrorSeverity,
  ): React.ComponentProps<typeof Badge>["variant"] =>
    sev === "error" ? "destructive" : sev === "warning" ? "default" : "outline";

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
    <Tabs defaultValue="qr">
      <TabsList>
        <TabsTrigger value="qr">{t("tabs.qr")}</TabsTrigger>
        <TabsTrigger value="onboarding">{t("tabs.onboarding")}</TabsTrigger>
        <TabsTrigger value="inquiries">{t("tabs.inquiries")}</TabsTrigger>
        <TabsTrigger value="errors">{t("tabs.errors")}</TabsTrigger>
      </TabsList>

      {/* ── QR ─────────────────────────────────────────── */}
      <TabsContent value="qr">
        {salons.length === 0 ? (
          <EmptyState>{t("empty.salons")}</EmptyState>
        ) : (
          <div className="space-y-6">
            {salons.map((salon) => {
              const qrLabels = {
                copy: t("qr.copy"),
                copied: t("qr.copied"),
                print: t("qr.print"),
              };
              return (
                <section
                  key={salon.slug}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  {/* 살롱 그룹 헤더 */}
                  <div className="flex items-start gap-3 border-b border-border pb-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold leading-tight">
                        {salon.name}
                      </h3>
                      {salon.placementLabel || salon.address ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {salon.placementLabel ?? salon.address}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* 디자이너별 QR + 살롱 공용 QR */}
                  <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {salon.designers.map((d) => (
                      <div key={d.id} className="flex flex-col gap-2">
                        <p className="text-center text-sm font-medium text-foreground">
                          {d.name}
                        </p>
                        <SalonQR
                          entryUrl={origin ? origin + d.entryPath : d.entryPath}
                          entryPath={d.entryPath}
                          salonName={`${salon.name} · ${d.name}`}
                          placement={salon.placementLabel ?? salon.address}
                          labels={qrLabels}
                        />
                      </div>
                    ))}
                    {/* 살롱 공용(지정없음) */}
                    <div className="flex flex-col gap-2">
                      <p className="text-center text-sm font-medium text-accent-text">
                        {t("qr.sharedLabel")}
                      </p>
                      <SalonQR
                        entryUrl={
                          origin
                            ? origin + salon.salonEntryPath
                            : salon.salonEntryPath
                        }
                        entryPath={salon.salonEntryPath}
                        salonName={`${salon.name} · ${t("qr.sharedLabel")}`}
                        placement={salon.placementLabel ?? salon.address}
                        labels={qrLabels}
                      />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* ── 온보딩(살롱/디자이너 생성) ───────────────────── */}
      <TabsContent value="onboarding">
        <Onboarding adminKey={adminKey} salons={salons} origin={origin} />
      </TabsContent>

      {/* ── 문의사항 ───────────────────────────────────── */}
      <TabsContent value="inquiries">
        <DataTable
          columns={inquiryColumns}
          rows={consultations}
          rowKey={(row) => row.id}
          onRowClick={(row) =>
            router.push(designerSummaryPath(row.designerToken))
          }
          empty={t("empty.inquiries")}
          caption={t("inquiries.title")}
        />
      </TabsContent>

      {/* ── 발생 에러 ──────────────────────────────────── */}
      <TabsContent value="errors">
        {errors.length === 0 ? (
          <EmptyState>{t("empty.errors")}</EmptyState>
        ) : (
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
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
