import { getTranslations } from "next-intl/server";
import { getReportView } from "@/lib/service";
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
  const data = await getReportView(token);

  if (!data) {
    return <InvalidEntry kind="report" />;
  }

  const {
    report,
    customerLocale,
    gender,
    age,
    visitCount,
    lastVisitDate,
    hair,
  } = data;

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
    before: t("report.before"),
    after: t("report.after"),
    styleRequest: t("report.styleRequest"),
    concerns: t("report.concerns"),
    cautions: t("report.cautions"),
    dna: {
      title: t("report.dna.title"),
      volume: t("report.dna.volume"),
      density: t("report.dna.density"),
      wave: t("report.dna.wave"),
      faceShape: t("report.dna.faceShape"),
    },
    satisfaction: {
      title: t("report.satisfaction.title"),
      thanks: t("report.satisfaction.thanks"),
      error: t("report.satisfaction.error"),
    },
    save: t("report.save"),
    saveToast: t("report.saveToast"),
    saveError: t("report.saveError"),
    share: t("report.share"),
    shareToast: t("report.shareToast"),
    scoreLabel: t("report.scoreLabel", { score: report.hairStateScore }),
    grade: gradeLabel(t, report.hairStateGrade),
    nationality: t("report.nationality"),
    gender: t("report.gender"),
    age: t("report.age"),
    visitHistory: t("report.visitHistory"),
  };

  // 프로필(국적은 손님 언어로 현지화) — 값이 있을 때만 행 노출.
  const profile = {
    nationality: t(`report.nationalityNames.${customerLocale}`),
    gender: gender ? t(`intake.about.genderOpt.${gender}`) : undefined,
    ageText:
      typeof age === "number" ? t("report.ageValue", { age }) : undefined,
  };

  // 방문 이력(카르테 연결 시만). 총 방문 + 최근 방문일.
  const visit =
    visitCount > 0
      ? {
          totalText: t("report.totalVisits", { count: visitCount }),
          lastText: lastVisitDate
            ? t("report.lastVisit", { date: formatDate(lastVisitDate, loc) })
            : undefined,
        }
      : undefined;

  return (
    <ReportView
      report={report}
      labels={labels}
      dateLabel={formatDate(report.date, loc)}
      profile={profile}
      visit={visit}
      hair={hair}
    />
  );
}

function gradeLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  grade: ThreeLevel,
): string {
  return t(`report.grade.${grade}`);
}
