import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDesignerInbox } from "@/lib/service";
import { getDesignerUser } from "@/lib/session-auth";
import { shareOrigin } from "@/lib/origin";
import { DesignerInboxView } from "@/components/designer/designer-inbox-view";

/**
 * 디자이너 인박스 (세션형, URL에 토큰 없음) — 로그인 세션으로 본인 디자이너 확정.
 * 기존 `/d/inbox/[staffToken]` 렌더(DesignerInboxView)를 재사용. 비디자이너 → /login.
 */
export const dynamic = "force-dynamic";

export default async function DesignerInboxSessionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const me = await getDesignerUser();
  if (!me) redirect(`/${locale}/login`);

  const h = await headers();
  const data = await getDesignerInbox(me.designer.staffToken);
  if (!data) redirect(`/${locale}/login`);

  const origin = shareOrigin(h.get("host"), h.get("x-forwarded-proto") ?? "http");
  return (
    <DesignerInboxView
      data={data}
      staffToken={me.designer.staffToken}
      origin={origin}
    />
  );
}
