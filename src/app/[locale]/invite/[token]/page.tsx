import { getTranslations } from "next-intl/server";
import { getInviteView } from "@/lib/service";
import { MobileFrame, ScreenBody } from "@/components/ui";
import { LogoSymbol } from "@/components/brand/logo";
import { InvalidEntry } from "@/components/customer/invalid-entry";
import { InviteAccept } from "@/components/invite/invite-accept";

/**
 * 디자이너 초대 수락(공개) — 유효 초대면 가입 폼 → 소속 확정.
 * 무효/만료/사용됨 → 안내 화면.
 */
export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });
  const view = await getInviteView(token);

  if (!view) {
    return <InvalidEntry kind="entry" />;
  }

  return (
    <MobileFrame tone="muted">
      <ScreenBody className="flex min-h-dvh flex-col justify-center gap-8 py-10">
        <div className="space-y-3 text-center">
          <LogoSymbol className="mx-auto size-12 text-brand" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t("invite.joinTitle", { salon: view.salonName })}
          </h1>
          <p className="mx-auto max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
            {t("invite.joinHint")}
          </p>
        </div>
        <InviteAccept
          token={token}
          locale={locale}
          labels={{
            name: t("invite.name"),
            email: t("invite.email"),
            password: t("invite.password"),
            submit: t("invite.submit"),
            pending: t("invite.pending"),
          }}
        />
      </ScreenBody>
    </MobileFrame>
  );
}
