import { getTranslations } from "next-intl/server";
import { getReportView, nextVisitLabel } from "@/lib/service";
import { formatDate } from "@/lib/catalog";
import type { ThreeLevel } from "@/lib/domain/types";
import { InvalidEntry } from "@/components/customer/invalid-entry";
import { ReportView, type ReportLabels } from "@/components/customer/report-view";

/**
 * C4 — 헤어 인바디 리포트. report.locale 로 렌더한다(손님 언어).
 * 서버에서 데이터/로케일 포맷을 만들고, 저장/공유/예약(mock) 버튼만 클라이언트.
 */
export default async function CustomerReportPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const report = await getReportView(token);

  if (!report) {
    return <InvalidEntry kind="report" />;
  }

  // 리포트는 항상 발급 당시 손님 언어(report.locale)로 렌더한다.
  // 라우트 locale 과 다를 수 있어, report.locale 로 번역을 직접 해석해 클라에 넘긴다.
  const loc = report.locale;
  const t = await getTranslations({ locale: loc, namespace: "Customer" });

  const labels: ReportLabels = {
    title: t("report.title"),
    subtitle: t("report.subtitle"),
    salon: t("report.salon"),
    designer: t("report.designer"),
    date: t("report.date"),
    service: t("report.service"),
    products: t("report.products"),
    hairState: t("report.hairState"),
    homeCare: t("report.homeCare"),
    nextVisit: t("report.nextVisit"),
    before: t("report.before"),
    after: t("report.after"),
    book: t("report.book"),
    bookToast: t("report.bookToast"),
    save: t("report.save"),
    saveToast: t("report.saveToast"),
    share: t("report.share"),
    shareToast: t("report.shareToast"),
    scoreLabel: t("report.scoreLabel", { score: report.hairStateScore }),
    grade: gradeLabel(t, report.hairStateGrade),
  };

  return (
    <ReportView
      report={report}
      labels={labels}
      dateLabel={formatDate(report.date, loc)}
      nextVisitText={nextVisitLabel(report.nextVisitWeeks, loc)}
    />
  );
}

function gradeLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  grade: ThreeLevel,
): string {
  return t(`report.grade.${grade}`);
}
