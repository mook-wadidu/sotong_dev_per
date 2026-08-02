import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCustomerView } from "@/lib/service";
import { shareOrigin } from "@/lib/origin";
import { absolute, handoffPath } from "@/lib/links";
import { HANDOFF_TTL_MS, makeHandoffToken } from "@/lib/entry";
import { MobileFrame, ScreenHeader, ScreenBody } from "@/components/ui";
import { PresentQr } from "./present-qr";

/**
 * 제시(present) 화면 — 인테이크 제출 후 랜딩 겸 재진입점.
 * 손님이 이 URL 을 저장했다가 매장에서 다시 열어, 화면의 QR 을 직원에게 보여준다.
 * QR 은 매 로드마다 새로 발급(force-dynamic)되는 단수명 핸드오프 토큰 — 노출창 최소화.
 * 스캔하면 /h/{token} 이 해당 상담의 디자이너 요약으로 인도한다.
 */
export const dynamic = "force-dynamic";

export default async function CustomerPresentPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const view = await getCustomerView(token);
  if (!view) notFound();

  const t = await getTranslations("Customer");

  // QR 절대 URL — 리포트 QR 과 동일한 origin 소스(shareOrigin)를 재사용.
  const h = await headers();
  const origin = shareOrigin(h.get("host"), h.get("x-forwarded-proto") ?? "http");
  // force-dynamic 서버 렌더 — 매 요청마다 새 만료시각으로 토큰을 발급하는 게 목적이라
  // clock 읽기(Date.now)는 의도된 불순도(하이드레이션 없음, 불안정 렌더 아님).
  // eslint-disable-next-line react-hooks/purity
  const handoff = makeHandoffToken(view.consultation.id, Date.now() + HANDOFF_TTL_MS);
  const qrUrl = absolute(origin, handoffPath(handoff));

  return (
    <MobileFrame tone="muted">
      {/* 지점명 없음(의도) — 이 화면은 손님이 '디자이너에게 보여주는' 핸드오프 면이라
          손님 소속 지점을 단정하지 않는다(사전작성 시점엔 매장 미확정). 헤더=화면 목적. */}
      <ScreenHeader title={t("present.title")} />
      <ScreenBody className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
        <div className="space-y-1.5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("present.subtitle")}
          </p>
        </div>

        {/* 디자이너용 고정 안내(ko) — 손님 언어와 무관하게 항상 한국어. 읽는 사람은 직원. */}
        <p
          lang="ko"
          className="w-full rounded-xl border border-border bg-accent-soft/60 px-4 py-3 text-sm font-semibold leading-relaxed text-accent-text"
        >
          다음 QR을 스캔하여 고객이 원하는 시술 정보를 확인하세요!
        </p>

        <PresentQr value={qrUrl} reshowLabel={t("present.reshow")} />

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("present.saveLinkHint")}
        </p>
      </ScreenBody>
    </MobileFrame>
  );
}
