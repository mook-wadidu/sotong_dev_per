import { getIntakeMenu, getReturningContext } from "@/lib/actions";
import { type Locale } from "@/lib/domain/types";
import { InvalidEntry } from "@/components/customer/invalid-entry";
import { IntakeStepper } from "@/components/customer/intake-stepper";

/**
 * C2 — 인테이크 서버 셸. 입장 토큰을 검증해 살롱별 시술 메뉴를 띄우고,
 * 실제 다단계 입력은 클라이언트 스테퍼(IntakeStepper)가 담당한다.
 *
 * 재방문 프리필: getReturningContext(쿠키 읽기 전용, 발급 안 함)로 기기 토큰을
 * 해석해 지난 모발 프로필/시술을 받아 스테퍼에 prop 으로 넘긴다. 매칭이 없으면
 * isReturning=false(신규 플로우). resolveEntry 실패면 null → 신규로 폴백.
 */
export default async function IntakePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const [menu, returning] = await Promise.all([
    getIntakeMenu(token),
    getReturningContext(token),
  ]);

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
      returning={returning ?? undefined}
    />
  );
}
