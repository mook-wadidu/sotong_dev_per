import { getTranslations } from "next-intl/server";
import { getDesignerView } from "@/lib/service";
import {
  MobileFrame,
  ScreenHeader,
  ScreenBody,
} from "@/components/ui";
import { RecordForm } from "@/components/designer/record-form";
import { BackToInbox } from "@/components/designer/back-to-inbox";

/**
 * D5 — 30초 기록 → 리포트 발송(ko 고정).
 * 사용 약제(PRODUCTS) / 모발상태(상·중·하) / before·after 사진.
 * 발송 후 손님 locale 의 리포트 링크 노출.
 */
export default async function DesignerReportPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("Designer");
  const view = await getDesignerView(token);

  if (!view) {
    return (
      <MobileFrame tone="muted">
        <ScreenHeader title={t("record.title")} />
        <ScreenBody className="flex flex-1 items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            {t("summary.notFound")}
          </p>
        </ScreenBody>
      </MobileFrame>
    );
  }

  const { consultation, staffToken, customerTreatments, salonServiceOptions } =
    view;
  // 실제 시술 선택지(살롱 메뉴, ko 라벨) — 디자이너가 실제 한 시술 기록.
  const serviceOptions = salonServiceOptions.map((s) => ({
    value: s.id,
    label: s.label.ko,
  }));
  // 재방문 프리필(PRD NOW #5) — 가장 최근 지난 시술의 약제·상태를 기록폼 기본값으로.
  const lastTreatment = consultation.isReturning
    ? customerTreatments[0]
    : undefined;

  return (
    <MobileFrame tone="muted">
      <ScreenHeader
        title={t("record.title")}
        subtitle={t("record.subtitle")}
        leading={
          <BackToInbox staffToken={staffToken} label={t("inbox.backToInbox")} />
        }
      />
      <ScreenBody>
        <RecordForm
          token={token}
          beforeUrl={consultation.beforePhotoUrl}
          defaultProducts={lastTreatment?.products}
          defaultGrade={lastTreatment?.stateGrade}
          serviceOptions={serviceOptions}
          labels={{
            products: t("record.products"),
            productsHint: t("record.productsHint"),
            addProduct: t("record.addProduct"),
            addProductPlaceholder: t("record.addProductPlaceholder"),
            stateGrade: t("record.stateGrade"),
            beforePhoto: t("record.beforePhoto"),
            afterPhoto: t("record.afterPhoto"),
            addPhoto: t("record.addPhoto"),
            removePhoto: t("record.removePhoto"),
            finish: t("record.finish"),
            finishing: t("record.finishing"),
            sent: t("record.sent"),
            failed: t("record.failed"),
            needInput: t("record.needInput"),
            needPhotos: t("record.needPhotos"),
            prefillHint: t("record.prefillHint"),
            prefillClear: t("record.prefillClear"),
            openReport: t("record.openReport"),
            gradeHigh: t("record.grade.high"),
            gradeMid: t("record.grade.mid"),
            gradeLow: t("record.grade.low"),
          }}
        />
      </ScreenBody>
    </MobileFrame>
  );
}
