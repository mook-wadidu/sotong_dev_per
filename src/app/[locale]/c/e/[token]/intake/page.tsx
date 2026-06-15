import { getIntakeMenu } from "@/lib/actions";
import { type Locale } from "@/lib/domain/types";
import { InvalidEntry } from "@/components/customer/invalid-entry";
import { IntakeStepper } from "@/components/customer/intake-stepper";

/**
 * C2 — 인테이크 서버 셸. 입장 토큰을 검증해 살롱별 시술 메뉴를 띄우고,
 * 실제 다단계 입력은 클라이언트 스테퍼(IntakeStepper)가 담당한다.
 */
export default async function IntakePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const menu = await getIntakeMenu(token);

  if (!menu) {
    return <InvalidEntry kind="entry" />;
  }

  const salonName = menu.nameTranslations
    ? (menu.nameTranslations[locale as Locale] ?? menu.salonName)
    : menu.salonName;

  return (
    <IntakeStepper
      entryToken={token}
      locale={locale as Locale}
      salonName={salonName}
      categories={menu.categories}
      services={menu.services}
    />
  );
}
