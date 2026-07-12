import { ReportScreen } from "@/components/customer/report-screen";

/**
 * C4 — 헤어 인바디 리포트(손님). 별점 입력 가능(canRate 기본 true). report.locale 로 렌더.
 * report_view 트래킹(살롱 귀속 포함)은 ReportScreen 안에서 canRate 게이트로 수행.
 */
export default async function CustomerReportPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  return <ReportScreen token={token} />;
}
