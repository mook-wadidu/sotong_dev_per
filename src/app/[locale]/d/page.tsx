import { getTranslations } from "next-intl/server";
import { MobileFrame, ScreenBody } from "@/components/ui";
import { DesignerLogin } from "@/components/designer/designer-login";
import { LogoSymbol } from "@/components/brand/logo";

/**
 * 디자이너 로그인 — 살롱에서 발급한 토큰으로 본인 인박스에 접속(어드민 게이트와 동일 UX).
 * 디자이너 뷰는 ko 고정이지만 게이트 카피는 현재 locale 로.
 */
export default async function DesignerLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Designer" });

  return (
    <MobileFrame tone="muted">
      <ScreenBody className="flex min-h-dvh flex-col justify-center gap-8 py-10">
        <div className="space-y-3 text-center">
          <LogoSymbol className="mx-auto size-12 text-brand" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t("login.title")}
          </h1>
          <p className="mx-auto max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
            {t("login.hint")}
          </p>
        </div>
        <DesignerLogin
          labels={{
            label: t("login.label"),
            placeholder: t("login.placeholder"),
            submit: t("login.submit"),
          }}
        />
      </ScreenBody>
    </MobileFrame>
  );
}
