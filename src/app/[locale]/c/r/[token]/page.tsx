import { ReportScreen } from "@/components/customer/report-screen";

/**
 * C4 — 헤어 인바디 리포트(손님). 별점 입력 가능(canRate 기본 true). report.locale 로 렌더.
 */
export default async function CustomerReportPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  return <ReportScreen token={token} />;
}
