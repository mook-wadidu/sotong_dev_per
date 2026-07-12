import { ReportScreen } from "@/components/customer/report-screen";
import { trackEvent } from "@/lib/track";

/**
 * C4 — 헤어 인바디 리포트(손님). 별점 입력 가능(canRate 기본 true). report.locale 로 렌더.
 */
export default async function CustomerReportPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  await trackEvent("report_view", { locale }); // 손님 리포트 열람
  return <ReportScreen token={token} />;
}
