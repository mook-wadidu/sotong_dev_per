import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Link from "next/link";
import { getAdminData, type AdminViewData } from "@/lib/service";
import {
  AdminShell,
  Button,
  buttonVariants,
  FormField,
  Input,
} from "@/components/ui";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { adminPath } from "@/lib/links";

/**
 * 어드민 대시보드 (ko 데스크톱/태블릿).
 * - searchParams.key 없으면 키 입력 게이트.
 * - key 있으면 getAdminData(key, salon) → 실패 시 인증 오류 화면.
 * - 통과 시 통계 타일 + 지점 필터 + Tabs(QR/문의/에러).
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; salon?: string }>;
}) {
  const { key, salon } = await searchParams;
  const t = await getTranslations("Admin");

  // ── 게이트: 키 없음 ──────────────────────────────────
  if (!key) {
    return (
      <AdminShell title={t("title")} subtitle={t("subtitle")}>
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-border bg-card p-8">
          <h2 className="text-lg font-semibold">{t("gate.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("gate.hint")}
          </p>
          <form method="get" className="mt-6 space-y-4">
            <FormField label={t("gate.label")}>
              <Input
                name="key"
                type="password"
                autoComplete="off"
                placeholder={t("gate.placeholder")}
                required
              />
            </FormField>
            <Button type="submit" className="w-full" size="lg">
              {t("gate.submit")}
            </Button>
          </form>
        </div>
      </AdminShell>
    );
  }

  // ── 인증 + 데이터 로드 ───────────────────────────────
  let data: AdminViewData;
  try {
    data = await getAdminData(key, salon);
  } catch {
    return (
      <AdminShell title={t("title")} subtitle={t("subtitle")}>
        <div className="mx-auto mt-12 max-w-md rounded-2xl border-2 border-foreground bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">
            {t("authError.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("authError.hint")}
          </p>
          <Link
            href="/ko/admin"
            className={buttonVariants({ variant: "outline", size: "lg" }) + " mt-6"}
          >
            {t("authError.retry")}
          </Link>
        </div>
      </AdminShell>
    );
  }

  const { salons, consultations, errors } = data;

  // QR 절대 URL 은 요청 Host 로 서버에서 만든다(클라 origin 의존 제거 — 어드민이 연 호스트/LAN IP 그대로 인코딩).
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  const stats = [
    { label: t("stats.salons"), value: salons.length },
    { label: t("stats.inquiries"), value: consultations.length },
    { label: t("stats.errors"), value: errors.length },
  ];

  // 지점 필터: 전체 + 각 살롱
  const filters: { label: string; slug?: string }[] = [
    { label: t("allSalons") },
    ...salons.map((s) => ({ label: s.name, slug: s.slug })),
  ];

  return (
    <AdminShell title={t("title")} subtitle={t("subtitle")}>
      {/* 통계 타일 */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4 sm:p-5"
          >
            <span className="text-xs font-medium text-muted-foreground sm:text-sm">
              {label}
            </span>
            <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* 지점 필터 */}
      <nav
        aria-label={t("salonFilter")}
        className="mb-6 flex flex-wrap gap-2"
      >
        {filters.map((f) => {
          const active = (f.slug ?? undefined) === (salon ?? undefined);
          return (
            <Link
              key={f.slug ?? "__all"}
              href={adminPath(key, f.slug)}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground"
                  : "inline-flex h-9 items-center rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <AdminTabs
        adminKey={key}
        origin={origin}
        salons={salons}
        consultations={consultations}
        errors={errors}
      />
    </AdminShell>
  );
}
