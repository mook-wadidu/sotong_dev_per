import { getTranslations } from "next-intl/server";
import { getSalonByEntry } from "@/lib/actions";
import { type Locale } from "@/lib/domain/types";
import { MobileFrame, ScreenBody } from "@/components/ui";
import { InvalidEntry } from "@/components/customer/invalid-entry";
import { LanguageChoices } from "@/components/customer/language-choices";

export default async function CustomerEntryPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const { salon, designer } = await getSalonByEntry(token);
  const t = await getTranslations({ locale, namespace: "Customer" });

  if (!salon) {
    return <InvalidEntry kind="entry" />;
  }

  const salonName = salon.nameTranslations
    ? (salon.nameTranslations[locale as Locale] ?? salon.name)
    : salon.name;

  return (
    <MobileFrame tone="muted">
      <ScreenBody className="flex min-h-dvh flex-col justify-center gap-8 py-10">
        {/* 살롱 이름 */}
        <div className="animate-rise space-y-3 text-center">
          <h1 className="text-2xl font-bold leading-tight text-foreground">
            {salonName}
          </h1>
          {designer ? (
            <p className="text-sm font-medium text-accent-text">
              {designer.name}
            </p>
          ) : null}
          <p className="mx-auto max-w-xs text-pretty text-sm text-muted-foreground">
            {t("langSelect.title")}
          </p>
        </div>

        {/* 언어 선택 */}
        <div className="animate-rise" style={{ animationDelay: "60ms" }}>
          <LanguageChoices entryToken={token} />
        </div>

        {/* 안심 카피 — 설치/로그인 불필요 */}
        <div className="animate-fade px-2 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("langSelect.reassure")}
          </p>
        </div>
      </ScreenBody>
    </MobileFrame>
  );
}
