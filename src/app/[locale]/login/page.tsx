import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSessionAccount } from "@/lib/session-auth";
import { listMyMembershipRequests } from "@/lib/actions";
import { AccountEntry } from "@/components/account/account-entry";
import { MembershipRequests } from "@/components/account/membership-requests";
import { MobileFrame, ScreenBody } from "@/components/ui";
import { LogoSymbol } from "@/components/brand/logo";
import type { MembershipRequest } from "@/lib/db/types";

/**
 * 통합 계정 로그인(오너·디자이너·어드민) — 이메일+비밀번호(Supabase Auth).
 * 로그인 세션이 있으면 role 로 각 콘솔에 라우팅(토큰은 서버 내부에서만 해석).
 * 미소속 디자이너는 "소속 대기" 안내.
 */
export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("Admin");

  const acc = await getSessionAccount();
  if (acc) {
    if (acc.role === "admin") redirect(`/${locale}/admin`);
    if (acc.role === "owner") redirect(`/${locale}/s`); // 세션형 클린 URL
    if (acc.role === "designer") redirect(`/${locale}/d/inbox`); // 세션형 클린 URL
    // designer-unaffiliated → 소속 대기 + 받은 요청 수락/거절
    const reqs = await listMyMembershipRequests();
    return (
      <WaitingScreen
        title={t("account.waitingTitle")}
        hint={t("account.waitingHint")}
        logout={t("nav.logout")}
        requests={reqs}
        reqLabels={{
          title: t("account.requestsTitle"),
          empty: t("account.requestsEmpty"),
          accept: t("account.accept"),
          decline: t("account.decline"),
          joinLabel: t("account.joinLabel"),
        }}
      />
    );
  }

  return (
    <MobileFrame tone="muted">
      <ScreenBody className="flex min-h-dvh flex-col justify-center gap-8 py-10">
        <div className="space-y-3 text-center">
          <LogoSymbol className="mx-auto size-12 text-brand" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t("login.title")}
          </h1>
          <p className="mx-auto max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
            {t("account.loginHint")}
          </p>
        </div>
        <AccountEntry
          locale={locale}
          labels={{
            email: t("login.email"),
            password: t("login.password"),
            name: t("invite.name"),
            login: t("login.submit"),
            signup: t("account.signupSubmit"),
            toSignup: t("account.toSignup"),
            toLogin: t("account.toLogin"),
            pending: t("login.pending"),
            error: t("login.error"),
            signupHint: t("account.signupPrompt"),
          }}
        />
      </ScreenBody>
    </MobileFrame>
  );
}

function WaitingScreen({
  title,
  hint,
  logout,
  requests,
  reqLabels,
}: {
  title: string;
  hint: string;
  logout: string;
  requests: MembershipRequest[];
  reqLabels: {
    title: string;
    empty: string;
    accept: string;
    decline: string;
    joinLabel: string;
  };
}) {
  return (
    <MobileFrame tone="muted">
      <ScreenBody className="flex min-h-dvh flex-col items-center justify-center gap-5 py-10 text-center">
        <LogoSymbol className="size-11 text-brand" />
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {hint}
        </p>
        <MembershipRequests initial={requests} labels={reqLabels} />
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/session/logout"
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {logout}
        </a>
      </ScreenBody>
    </MobileFrame>
  );
}
