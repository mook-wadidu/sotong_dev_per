import { getTranslations } from "next-intl/server";
import { getReportView } from "@/lib/service";
import { formatDate } from "@/lib/catalog";
import type { ThreeLevel } from "@/lib/domain/types";
import { InvalidEntry } from "@/components/customer/invalid-entry";
import {
  ReportView,
  type ReportLabels,
} from "@/components/customer/report-view";

/**
 * 헤어 인바디 리포트 화면 — 손님(/c/r)·디자이너(/d/r) 공용. 항상 report.locale 로 렌더.
 * canRate=true(손님): 별점 입력 가능. canRate=false(디자이너): 별점 읽기전용 + 손님 제출 점수 표시.
 * 역할별 입력 권한 분리(같은 내용을 봐도 입력은 손님만).
 */
export async function ReportScreen({
  token,
  canRate = true,
  homeHref,
}: {
  token: string;
  canRate?: boolean;
  /** 뒤로 버튼 no-history 폴백. 디자이너 뷰는 디자이너 경로(예: /ko/d) 전달. */
  homeHref?: string;
}) {
  const data = await getReportView(token);
  if (!data) return <InvalidEntry kind="report" />;

  const {
    report,
    customerLocale,
    gender,
    age,
    visitCount,
    lastVisitDate,
    hair,
    satisfactionScore,
  } = data;

  // 리포트는 항상 발급 당시 손님 언어(report.locale)로 렌더한다.
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
      readOnly: t("report.satisfaction.readOnly"),
    },
    back: t("report.back"),
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

  const profile = {
    nationality: t(`report.nationalityNames.${customerLocale}`),
    gender: gender ? t(`intake.about.genderOpt.${gender}`) : undefined,
    ageText:
      typeof age === "number" ? t("report.ageValue", { age }) : undefined,
  };

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
      canRate={canRate}
      satisfactionScore={canRate ? undefined : satisfactionScore}
      homeHref={homeHref}
    />
  );
}

function gradeLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  grade: ThreeLevel,
): string {
  return t(`report.grade.${grade}`);
}
