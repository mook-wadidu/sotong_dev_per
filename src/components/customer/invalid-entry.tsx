import { getTranslations } from "next-intl/server";
import { MobileFrame, ScreenBody } from "@/components/ui";

/**
 * 무효 토큰 안내 (서버 컴포넌트). C1 입장 / C3 스레드 / C4 리포트 공용.
 * 친절한 톤으로 "다시 시도" 경로를 알려준다 (손님에게 에러 코드/디버그 노출 금지).
 */
export async function InvalidEntry({
  kind,
}: {
  kind: "entry" | "thread" | "report";
}) {
  const t = await getTranslations("Customer");
  const body =
    kind === "thread"
      ? t("invalid.thread")
      : kind === "report"
        ? t("invalid.report")
        : t("invalid.body");

  return (
    <MobileFrame tone="muted">
      <ScreenBody className="flex min-h-dvh flex-col items-center justify-center gap-4 py-10 text-center">
        <h1 className="text-lg font-bold text-foreground">
          {t("invalid.title")}
        </h1>
        <p className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </ScreenBody>
    </MobileFrame>
  );
}
