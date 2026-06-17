import { getCustomerView } from "@/lib/service";
import { type Locale } from "@/lib/domain/types";
import { InvalidEntry } from "@/components/customer/invalid-entry";
import { CustomerThread } from "@/components/customer/customer-thread";

/**
 * C3 — 손님 상담 스레드 서버 셸.
 * 초기 메시지/살롱은 service 로 가져오고, 이후 폴링/전송은 클라이언트가 actions 로 처리.
 */
export default async function CustomerThreadPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const view = await getCustomerView(token);

  if (!view) {
    return <InvalidEntry kind="thread" />;
  }

  const salonName = view.salon
    ? (view.salon.nameTranslations?.[locale as Locale] ?? view.salon.name)
    : "";

  return (
    <CustomerThread
      token={token}
      locale={locale as Locale}
      salonName={salonName}
      initialMessages={view.messages}
      initialStatus={view.consultation.status}
      initialReportToken={view.consultation.reportToken}
    />
  );
}
