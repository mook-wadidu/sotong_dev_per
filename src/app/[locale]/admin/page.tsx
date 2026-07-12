import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Link from "next/link";
import {
  getAdminData,
  getSalonConsole,
  adminListAnnouncements,
  type AdminViewData,
} from "@/lib/service";
import { AdminShell, buttonVariants } from "@/components/ui";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminInquiries, AdminErrors } from "@/components/admin/admin-sections";
import { AdminAnalyticsView } from "@/components/admin/admin-analytics";
import {
  getAdminAnalytics,
  type AnalyticsRange,
} from "@/lib/admin-analytics";
import { AdminReports } from "@/components/admin/admin-reports";
import { getAdminReports } from "@/lib/admin-reports";
import { AdminDataset } from "@/components/admin/admin-dataset";
import { getTrainingDataStatus } from "@/lib/admin-dataset";
import { AdminDesigners } from "@/components/admin/admin-designers";
import { getAdminDesigners } from "@/lib/admin-designers";
import { AdminAnnouncements } from "@/components/admin/admin-announcements";
import { SalonManageSection } from "@/components/admin/salon-manage-section";
import { Onboarding } from "@/components/admin/onboarding";
import { adminPath, salonConsolePath, type AdminView } from "@/lib/links";
import { shareOrigin } from "@/lib/origin";
import { readAdminSession } from "@/lib/admin-session";
import { getAdminUser } from "@/lib/admin-auth";
import { AdminLogin, type AdminLoginLabels } from "@/components/admin/admin-login";

const VIEWS: AdminView[] = [
  "dashboard",
  "analytics",
  "reports",
  "dataset",
  "designers",
  "salons",
  "inquiries",
  "errors",
  "onboarding",
];

/** adminPath/salonConsolePath 등은 /ko 고정 — 인앱 nav 가 현재 로케일을 유지하도록
 *  선두 /ko 세그먼트만 현재 로케일로 치환(언어 전환 후 클릭 시 ko 로 되돌아가지 않게). */
const localizeHref = (href: string, locale: string) =>
  href.replace(/^\/ko(?=\/|$|\?)/, `/${locale}`);

/**
 * 어드민 대시보드 (ko 데스크톱/태블릿) — 사이드바 기반.
 * - 세션 쿠키 무효 → 중립 "잘못된 접근" 화면(폼 없음).
 * - 유효 → getAdminData(salon)(서버 재검증) → AdminLayout(사이드바) + view 분기.
 * - 진입은 /api/admin/enter?key=... 가 쿠키를 발급(페이지엔 키 게이트 없음).
 */
export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ salon?: string; view?: string; range?: string }>;
}) {
  const { locale } = await params;
  const { salon, view: viewParam, range: rangeParam } = await searchParams;
  const t = await getTranslations("Admin");

  // ── 게이트: Google 어드민 세션 OR 공유키 세션(브레이크글래스) ────────
  // 프로바이더 미설정 시 getAdminUser()는 null → 기존 공유키 경로가 그대로 유지된다(비파괴).
  const authed = (await getAdminUser()) || (await readAdminSession());
  if (!authed) {
    return (
      <AdminLoginScreen
        title={t("login.title")}
        labels={{
          email: t("login.email"),
          password: t("login.password"),
          submit: t("login.submit"),
          pending: t("login.pending"),
          error: t("login.error"),
        }}
      />
    );
  }

  // 세션 통과 → 데이터 로드(서버에서 재검증).
  const data: AdminViewData = await getAdminData(salon);
  const { salons, consultations, errors } = data;
  const view: AdminView = VIEWS.includes(viewParam as AdminView)
    ? (viewParam as AdminView)
    : "dashboard";

  // 분석 뷰일 때만 집계 로드(다른 뷰에 불필요한 스캔 방지).
  const range: AnalyticsRange = ([7, 30, 90] as const).includes(
    Number(rangeParam) as AnalyticsRange,
  )
    ? (Number(rangeParam) as AnalyticsRange)
    : 30;
  const analytics =
    view === "analytics"
      ? await getAdminAnalytics({ range, salonSlug: salon })
      : null;
  const reports = view === "reports" ? await getAdminReports() : null;
  const dataset = view === "dataset" ? await getTrainingDataStatus() : null;
  const designers = view === "designers" ? await getAdminDesigners() : null;
  const announcements =
    view === "notices" ? await adminListAnnouncements() : null;

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
    <AdminShell
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        // 라우트핸들러(쿠키 만료 + 리다이렉트)로의 "전체 페이지 이동"이 필요 —
        // next/link 의 클라 네비게이션은 Set-Cookie 리다이렉트를 제대로 타지 않는다.
        // (api 경로는 페이지가 아니므로 아래 룰은 오탐.)
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href="/api/admin/exit"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("nav.logout")}
        </a>
      }
    >
      <AdminLayout view={view}>
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
                          href={localizeHref(
                            adminPath({ view: "salons", salon: s.slug }),
                            locale,
                          )}
                          className={buttonVariants({
                            variant: "default",
                            size: "sm",
                          })}
                        >
                          {t("dashboard.manage")}
                        </Link>
                        <a
                          href={localizeHref(salonConsolePath(s.ownerToken), locale)}
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

        {view === "analytics" && analytics ? (
          <div className="space-y-4">
            <SalonFilter
              locale={locale}
              view="analytics"
              salons={salons}
              selected={salon}
              label={t("salonFilter")}
              allLabel={t("allSalons")}
            />
            <AdminAnalyticsView data={analytics} locale={locale} salon={salon} />
          </div>
        ) : null}

        {view === "reports" && reports ? (
          <AdminReports rows={reports.rows} />
        ) : null}

        {view === "dataset" && dataset ? (
          <AdminDataset data={dataset} />
        ) : null}

        {view === "designers" && designers ? (
          <AdminDesigners rows={designers} />
        ) : null}

        {view === "notices" && announcements ? (
          <AdminAnnouncements items={announcements} />
        ) : null}

        {view === "salons" ? (
          <SalonsView
            origin={origin}
            salons={salons}
            selectedSlug={salon}
            locale={locale}
          />
        ) : null}

        {view === "inquiries" ? (
          <div className="space-y-4">
            <SalonFilter
              locale={locale}
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
              locale={locale}
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
          <Onboarding salons={salons} origin={origin} />
        ) : null}
      </AdminLayout>
    </AdminShell>
  );
}

/**
 * 미인증 진입 화면 — 중립 카드 + Google 로그인 버튼.
 * 기존 중립 "잘못된 접근" 카드를 유지하되 어드민 Google SSO 버튼을 얹는다.
 * 공유키(break-glass) 진입은 여전히 /api/admin/enter?key= 로 (URL 노출 없음).
 */
function AdminLoginScreen({
  title,
  labels,
}: {
  title: string;
  labels: AdminLoginLabels;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8">
        <p className="text-center text-base font-semibold text-foreground">{title}</p>
        <AdminLogin labels={labels} />
      </div>
    </div>
  );
}

/** 접수/오류 뷰 지점 필터(전역) — URL 로 유지. */
function SalonFilter({
  locale,
  view,
  salons,
  selected,
  label,
  allLabel,
}: {
  locale: string;
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
            href={localizeHref(adminPath({ view, salon: f.slug }), locale)}
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
  origin,
  salons,
  selectedSlug,
  locale,
}: {
  origin: string;
  salons: AdminViewData["salons"];
  selectedSlug?: string;
  locale: string;
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
                  href={localizeHref(
                    adminPath({ view: "salons", salon: s.slug }),
                    locale,
                  )}
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
          href={localizeHref(adminPath({ view: "salons" }), locale)}
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
