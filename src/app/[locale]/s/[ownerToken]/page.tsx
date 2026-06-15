import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { getSalonConsole } from "@/lib/service";
import { AdminShell } from "@/components/ui";
import { SalonConsole } from "@/components/salon-console/salon-console";

/**
 * 살롱 오너 콘솔 (ko 데스크톱/태블릿).
 * - ownerToken 검증(getSalonConsole) → 무효면 안내 화면.
 * - 통과 시 AdminShell + Tabs(메뉴/디자이너/QR/문의).
 * - QR 절대 URL 은 요청 Host 로 서버에서 만든다(어드민 페이지와 동일 패턴).
 * 손님 URL 에는 ownerToken 을 노출하지 않는다(어드민 키 동급 비밀).
 */
export default async function SalonConsolePage({
  params,
}: {
  params: Promise<{ locale: string; ownerToken: string }>;
}) {
  const { ownerToken } = await params;
  const t = await getTranslations("Admin");

  const data = await getSalonConsole(ownerToken);

  if (!data) {
    return (
      <AdminShell title={t("console.title")} subtitle={t("console.subtitle")}>
        <div className="mx-auto mt-12 max-w-md rounded-2xl border-2 border-foreground bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">
            {t("console.invalid.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("console.invalid.hint")}
          </p>
        </div>
      </AdminShell>
    );
  }

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <AdminShell
      title={data.salon.name}
      subtitle={t("console.subtitle")}
    >
      <SalonConsole ownerToken={ownerToken} origin={origin} data={data} />
    </AdminShell>
  );
}
