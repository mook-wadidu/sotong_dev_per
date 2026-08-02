import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCustomerView } from "@/lib/service";
import { shareOrigin } from "@/lib/origin";
import {
  absolute,
  customerPresentPath,
  handoffPath,
  reportPath,
} from "@/lib/links";
import { HANDOFF_TTL_MS, makeHandoffToken } from "@/lib/entry";
import { type Locale } from "@/lib/domain/types";
import {
  MobileFrame,
  ScreenHeader,
  ScreenBody,
  buttonVariants,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { PresentQr } from "./present-qr";
import { CopyLink } from "./copy-link";

/**
 * 제시(present) 화면 — 인테이크 제출 후 랜딩 겸 **재진입점**.
 * 이 URL(consultationToken)은 장수명·기기무관 개인 링크라 손님이 저장하면 어디서든 재접근한다.
 *  - 완료 전: 직원 스캔용 **단수명 핸드오프 QR**(force-dynamic, 매 로드 새 토큰) + 손님 저장용 "내 링크"(복사).
 *  - 완료 후(status=completed & reportToken): 같은 링크가 **리포트 확인처로 전환**(adaptive) — 손님이
 *    "저장해둔 링크에서 나중에 리포트를 본다"가 실제로 성립하게 한다.
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

  const t = await getTranslations("Customer");
  const loc = locale as Locale;
  const { status, reportToken } = view.consultation;

  // 완료 + 리포트 발급됨 → 이 개인 링크가 리포트 확인처로 전환(adaptive 재진입).
  if (status === "completed" && reportToken) {
    return (
      <MobileFrame tone="muted">
        <ScreenHeader title={t("present.title")} />
        <ScreenBody className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
          <p className="text-lg font-bold leading-snug text-foreground">
            {t("present.completed")}
          </p>
          <Link
            href={reportPath(reportToken, loc)}
            className={cn(buttonVariants({ variant: "accent", size: "lg" }), "w-full")}
          >
            {t("present.viewReport")}
          </Link>
        </ScreenBody>
      </MobileFrame>
    );
  }

  // 완료 전 — 직원 스캔용 핸드오프 QR(절대 URL, 리포트 QR 과 동일 origin 소스).
  const h = await headers();
  const origin = shareOrigin(h.get("host"), h.get("x-forwarded-proto") ?? "http");
  // force-dynamic 서버 렌더 — 매 요청마다 새 만료시각으로 토큰 발급이 목적이라
  // clock 읽기(Date.now)는 의도된 불순도(하이드레이션 없음, 불안정 렌더 아님).
  // eslint-disable-next-line react-hooks/purity
  const handoff = makeHandoffToken(view.consultation.id, Date.now() + HANDOFF_TTL_MS);
  const qrUrl = absolute(origin, handoffPath(handoff));
  // 손님 저장용 개인 링크(이 present URL 자체) — 장수명·기기무관.
  const myLink = absolute(origin, customerPresentPath(token, loc));

  return (
    <MobileFrame tone="muted">
      {/* 지점명 없음(의도) — 손님이 '디자이너에게 보여주는' 핸드오프 면이라 소속 지점 미단정. */}
      <ScreenHeader title={t("present.title")} />
      <ScreenBody className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("present.subtitle")}
        </p>

        {/* 디자이너용 고정 안내(ko) — 손님 언어 무관 항상 한국어. 읽는 사람은 직원. */}
        <p
          lang="ko"
          className="w-full rounded-xl border border-border bg-accent-soft/60 px-4 py-3 text-sm font-semibold leading-relaxed text-accent-text"
        >
          다음 QR을 스캔하여 고객이 원하는 시술 정보를 확인하세요!
        </p>

        <PresentQr value={qrUrl} reshowLabel={t("present.reshow")} />

        {/* 손님 저장용 "내 링크" — 복사 노출. 기기 무관 재진입 + 시술 후 리포트도 여기서. */}
        <div className="w-full space-y-1.5">
          <p className="text-left text-xs font-semibold text-foreground">
            {t("present.myLinkTitle")}
          </p>
          <CopyLink
            value={myLink}
            copyLabel={t("present.copy")}
            copiedMsg={t("present.copied")}
          />
          <p className="text-left text-xs leading-relaxed text-muted-foreground">
            {t("present.saveLinkHint")}
          </p>
        </div>
      </ScreenBody>
    </MobileFrame>
  );
}
