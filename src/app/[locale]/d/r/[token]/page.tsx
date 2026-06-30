import { ReportScreen } from "@/components/customer/report-screen";

/**
 * 디자이너용 리포트 '보기'(읽기전용). 손님 reportToken 재사용 — 같은 내용을 보되
 * 별점(만족도)은 손님 입력 필드라 디자이너는 읽기전용(canRate=false). 헤더 뒤로 버튼으로 복귀.
 */
export default async function DesignerReportViewPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  // 디자이너 뷰 — 별점 읽기전용, 뒤로 폴백은 디자이너 로그인/인박스(손님 랜딩 아님).
  return <ReportScreen token={token} canRate={false} homeHref="/ko/d" />;
}
