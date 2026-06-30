import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Link from "next/link";
import {
  getAdminData,
  getSalonConsole,
  type AdminViewData,
} from "@/lib/service";
import {
  AdminShell,
  Button,
  buttonVariants,
  FormField,
  Input,
} from "@/components/ui";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminInquiries, AdminErrors } from "@/components/admin/admin-sections";
import { SalonManageSection } from "@/components/admin/salon-manage-section";
import { Onboarding } from "@/components/admin/onboarding";
import {
  adminPath,
  adminGatePath,
  salonConsolePath,
  type AdminView,
} from "@/lib/links";
import { shareOrigin } from "@/lib/origin";

const VIEWS: AdminView[] = [
  "dashboard",
  "salons",
  "inquiries",
  "errors",
  "onboarding",
];

/**
 * 어드민 대시보드 (ko 데스크톱/태블릿) — 사이드바 기반.
 * - searchParams.key 없으면 키 입력 게이트.
 * - key 있으면 getAdminData(key, salon) → 실패 시 인증 오류 화면.
 * - 통과 시 AdminLayout(사이드바) + view 분기.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; salon?: string; view?: string }>;
}) {
  const { key, salon, view: viewParam } = await searchParams;
  const t = await getTranslations("Admin");

  // ── 게이트: 키 없음 ──────────────────────────────────
  if (!key) {
    return (
      <AdminShell title={t("title")} subtitle={t("subtitle")}>
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-border bg-card p-8">
          <h2 className="text-lg font-semibold">{t("gate.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("gate.hint")}</p>
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
          <h2 className="text-lg font-semibold">{t("gate.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("gate.hint")}</p>
          {/* 같은(틀린) 키로 재이동하면 변화가 없으므로, 키 없는 게이트(입력 폼)로 보낸다. */}
          <Link
            href={adminGatePath()}
            className={
              buttonVariants({ variant: "outline", size: "lg" }) + " mt-6"
            }
          >
            {t("gate.retry")}
          </Link>
        </div>
      </AdminShell>
    );
  }

  const { salons, consultations, errors } = data;
  const view: AdminView = VIEWS.includes(viewParam as AdminView)
    ? (viewParam as AdminView)
    : "dashboard";

  // QR 절대 URL — 운영 정식 도메인(NEXT_PUBLIC_BASE_URL) 우선(보호된 프리뷰 호스트
  // 인코딩 → 모바일 Vercel 로그인 벽 방지), 미설정 시 요청 Host 폴백.
  const h = await headers();
  const origin = shareOrigin(h.get("host"), h.get("x-forwarded-proto") ?? "http");

  const stats = [
    { label: t("stats.salons"), value: salons.length },
    { label: t("stats.inquiries"), value: consultations.length },
    { label: t("stats.errors"), value: errors.length },
  ];

  return (
    <AdminShell title={t("title")} subtitle={t("subtitle")}>
      <AdminLayout adminKey={key} view={view}>
        {view === "dashboard" ? (
          <div className="space-y-6">
            {/* 통계 타일 */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
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

            {/* 살롱 개요 리스트 */}
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold leading-tight">
                  {t("dashboard.title")}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("dashboard.hint")}
                </p>
              </div>
              {salons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
                  {t("empty.salons")}
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {salons.map((s) => (
                    <li
                      key={s.slug}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold leading-tight">
                          {s.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("dashboard.designerCount", {
                            count: s.designers.length,
                          })}
                          {" · "}
                          {t("dashboard.inquiryCount", {
                            count: s.designers.reduce(
                              (acc, d) => acc + d.consultationCount,
                              0,
                            ),
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Link
                          href={adminPath(key, { view: "salons", salon: s.slug })}
                          className={buttonVariants({
                            variant: "default",
                            size: "sm",
                          })}
                        >
                          {t("dashboard.manage")}
                        </Link>
                        <a
                          href={salonConsolePath(s.ownerToken)}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          {t("dashboard.console")}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {view === "salons" ? (
          <SalonsView
            adminKey={key}
            origin={origin}
            salons={salons}
            selectedSlug={salon}
          />
        ) : null}

        {view === "inquiries" ? (
          <div className="space-y-4">
            <SalonFilter
              adminKey={key}
              view="inquiries"
              salons={salons}
              selected={salon}
              label={t("salonFilter")}
              allLabel={t("allSalons")}
            />
            <AdminInquiries salons={salons} consultations={consultations} />
          </div>
        ) : null}

        {view === "errors" ? (
          <div className="space-y-4">
            <SalonFilter
              adminKey={key}
              view="errors"
              salons={salons}
              selected={salon}
              label={t("salonFilter")}
              allLabel={t("allSalons")}
            />
            <AdminErrors errors={errors} />
          </div>
        ) : null}

        {view === "onboarding" ? (
          <Onboarding adminKey={key} salons={salons} origin={origin} />
        ) : null}
      </AdminLayout>
    </AdminShell>
  );
}

/** 접수/오류 뷰 지점 필터(전역) — URL 로 유지. */
function SalonFilter({
  adminKey,
  view,
  salons,
  selected,
  label,
  allLabel,
}: {
  adminKey: string;
  view: AdminView;
  salons: AdminViewData["salons"];
  selected?: string;
  label: string;
  allLabel: string;
}) {
  const filters: { label: string; slug?: string }[] = [
    { label: allLabel },
    ...salons.map((s) => ({ label: s.name, slug: s.slug })),
  ];
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {filters.map((f) => {
        const active = (f.slug ?? undefined) === (selected ?? undefined);
        return (
          <Link
            key={f.slug ?? "__all"}
            href={adminPath(adminKey, { view, salon: f.slug })}
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
  );
}

/** 지점 관리 뷰 — 살롱 선택 시 접속 정보 + 전체 편집, 없으면 선택 리스트. */
async function SalonsView({
  adminKey,
  origin,
  salons,
  selectedSlug,
}: {
  adminKey: string;
  origin: string;
  salons: AdminViewData["salons"];
  selectedSlug?: string;
}) {
  const t = await getTranslations("Admin");
  const selected = selectedSlug
    ? salons.find((s) => s.slug === selectedSlug)
    : undefined;

  // 선택 없음 → 살롱 선택 리스트
  if (!selected) {
    return (
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold leading-tight">
            {t("manage.selectTitle")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("manage.selectHint")}
          </p>
        </div>
        {salons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
            {t("empty.salons")}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {salons.map((s) => (
              <li key={s.slug}>
                <Link
                  href={adminPath(adminKey, { view: "salons", salon: s.slug })}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold leading-tight">
                      {s.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("dashboard.designerCount", {
                        count: s.designers.length,
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">
                    {t("dashboard.manage")} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // 선택 살롱 → ownerToken 으로 콘솔 데이터 로드(server-only).
  const consoleData = await getSalonConsole(selected.ownerToken);
  if (!consoleData) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
        {t("manage.notFound")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={adminPath(adminKey, { view: "salons" })}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {t("nav.salons")}
        </Link>
        <h2 className="truncate text-base font-semibold leading-tight">
          {selected.name}
        </h2>
      </div>
      <SalonManageSection
        ownerToken={selected.ownerToken}
        origin={origin}
        salon={selected}
        data={consoleData}
      />
    </div>
  );
}
