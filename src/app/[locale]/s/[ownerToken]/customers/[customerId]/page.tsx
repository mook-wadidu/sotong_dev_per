import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCustomerHistory } from "@/lib/service";
import { AdminShell, buttonVariants } from "@/components/ui";
import { CustomerHistory } from "@/components/salon-console/customer-history";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/domain/types";

/**
 * 사장 콘솔 — 회원별 시술 이력(카르테 타임라인).
 * getCustomerHistory(ownerToken, customerId) 로 살롱 스코프를 강제해 그 살롱
 * treatment 만 받는다. ownerToken 무효/타 살롱/이력 0건이면 null → 빈 상태 안내.
 * ownerToken 은 손님에게 노출하지 않는 비밀이므로 URL 외 클라 props 로 싣지 않는다.
 */
export default async function CustomerHistoryPage({
  params,
}: {
  params: Promise<{ locale: string; ownerToken: string; customerId: string }>;
}) {
  const { locale, ownerToken, customerId } = await params;
  const t = await getTranslations("Admin");

  const data = await getCustomerHistory(ownerToken, customerId);
  const backHref = `/${locale}/s/${ownerToken}`;

  if (!data) {
    return (
      <AdminShell
        title={t("console.customers.title")}
        subtitle={t("console.customers.subtitle")}
      >
        <div className="mx-auto mt-12 max-w-md rounded-2xl border-2 border-foreground bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">
            {t("console.customers.invalid.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("console.customers.invalid.hint")}
          </p>
          <Link
            href={backHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "mt-5",
            )}
          >
            {t("console.customers.back")}
          </Link>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={t("console.customers.title")}
      subtitle={t("console.customers.subtitle")}
    >
      <div className="mb-5">
        <Link
          href={backHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {t("console.customers.back")}
        </Link>
      </div>
      <CustomerHistory
        locale={locale as Locale}
        treatments={data.treatments}
      />
    </AdminShell>
  );
}
