import { getCustomerView } from "@/lib/service";
import { tx, type Locale } from "@/lib/domain/types";
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

  const loc = locale as Locale;
  const salonName = view.salon
    ? (view.salon.nameTranslations?.[loc] ?? view.salon.name)
    : "";

  // 시술중 화면용 요약 — 시술 라벨은 손님 언어로 resolve, 나머지는 인테이크 원본(손님 언어).
  const intake = view.consultation.intake;
  const summary = {
    services: (intake.serviceIds ?? []).map((id) => {
      const label = view.serviceLabelMap?.[id];
      return label ? tx(label, loc) : id;
    }),
    styleText: intake.styleNote,
    photos: intake.stylePhotoUrls ?? [],
    memo: intake.concernNote,
    gender: intake.gender,
    age: intake.age,
  };

  return (
    <CustomerThread
      token={token}
      locale={loc}
      salonName={salonName}
      initialMessages={view.messages}
      initialStatus={view.consultation.status}
      initialReportToken={view.consultation.reportToken}
      summary={summary}
    />
  );
}
