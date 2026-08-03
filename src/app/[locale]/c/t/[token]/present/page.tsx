import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCustomerView } from "@/lib/service";
import { shareOrigin } from "@/lib/origin";
import { absolute, customerPresentPath, handoffPath } from "@/lib/links";
import { HANDOFF_TTL_MS, makeHandoffToken } from "@/lib/entry";
import { type Locale } from "@/lib/domain/types";
import { PresentLive } from "./present-live";

/**
 * 제시(present) 화면 — 인테이크 제출 후 랜딩 겸 **재진입점**. 서버는 초기값(핸드오프 QR·내 링크·
 * 여정 신호)만 계산하고, 실제 라이브 상태머신은 클라 <PresentLive> 가 폴링으로 돌린다.
 *  - force-dynamic: 매 로드 새 만료시각으로 핸드오프 토큰 발급(직원 스캔용 단수명 QR).
 *  - PresentLive 파생: completed→리포트 / chat_started→채팅 자동입장 / designer_viewed→"확인 중" / 그 외→QR.
 */
export const dynamic = "force-dynamic";

export default async function CustomerPresentPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const view = await getCustomerView(token);
  if (!view) notFound();

  const loc = locale as Locale;
  const c = view.consultation;

  const h = await headers();
  const origin = shareOrigin(h.get("host"), h.get("x-forwarded-proto") ?? "http");
  // force-dynamic 서버 렌더 — 매 요청마다 새 만료시각 토큰 발급이 목적(하이드레이션 없음).
  // eslint-disable-next-line react-hooks/purity
  const handoff = makeHandoffToken(c.id, Date.now() + HANDOFF_TTL_MS);
  const qrUrl = absolute(origin, handoffPath(handoff));
  const myLink = absolute(origin, customerPresentPath(token, loc));

  return (
    <PresentLive
      token={token}
      locale={loc}
      qrUrl={qrUrl}
      myLink={myLink}
      initialStatus={c.status}
      initialReportToken={c.reportToken}
      initialDesignerViewedAt={c.designerViewedAt}
      initialChatStartedAt={c.chatStartedAt}
      initialDesignerEditingAt={c.designerEditingAt}
    />
  );
}
