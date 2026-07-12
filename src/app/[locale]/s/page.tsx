import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSalonConsole, recordOwnerTokenSeen } from "@/lib/service";
import { getSalonUser } from "@/lib/session-auth";
import { shareOrigin } from "@/lib/origin";
import { AdminShell } from "@/components/ui";
import { SalonConsole } from "@/components/salon-console/salon-console";
import { AnnouncementBanner } from "@/components/announcement-banner";

/**
 * 오너 콘솔 (세션형, URL에 토큰 없음) — 로그인 세션으로 본인 살롱을 확정.
 * 기존 `/s/[ownerToken]` 로더/렌더를 그대로 재사용(ownerToken은 서버 내부에서만).
 * 미로그인/비오너 → /login.
 */
export const dynamic = "force-dynamic";

export default async function SalonConsoleSessionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const owner = await getSalonUser();
  if (!owner) redirect(`/${locale}/login`);

  const t = await getTranslations("Admin");
  const h = await headers();
  const data = await getSalonConsole(owner.salon.ownerToken);
  if (!data) redirect(`/${locale}/login`);

  recordOwnerTokenSeen(data.salon.slug, h.get("x-real-ip"));
  const origin = shareOrigin(h.get("host"), h.get("x-forwarded-proto") ?? "http");

  return (
    <AdminShell title={data.salon.name} subtitle={t("console.subtitle")}>
      <div className="mb-4">
        <AnnouncementBanner
          audiences={["salon", "platform"]}
          salonSlug={data.salon.slug}
          locale="ko"
        />
      </div>
      <SalonConsole
        ownerToken={owner.salon.ownerToken}
        origin={origin}
        data={data}
      />
    </AdminShell>
  );
}
