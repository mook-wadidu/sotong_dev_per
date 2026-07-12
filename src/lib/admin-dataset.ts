import "server-only";
import { getRepo } from "@/lib/db";

/**
 * 어드민 AI 학습 데이터셋 현황 — 건수·동의율·스키마·가명/파기 정책 요약.
 * 원본(개별 샘플/사진)은 노출하지 않는다 — 집계 현황과 "학습 판단 근거"만.
 */

export interface TrainingDataStatus {
  sampleCount: number;
  photo: { before: number; after: number; style: number; total: number };
  completedConsults: number;
  trainingConsented: number;
  photoConsented: number;
  trainingConsentRate: number; // 0~1 (완료 상담 대비)
  photoConsentRate: number;
  /** 수집 피처(가명 데이터셋 컬럼) — 기술 스키마(비-PII). */
  featureFields: string[];
  /** 학습에서 제외되는 PII/원본. */
  excludedPii: string[];
  pseudonymNote: string; // 가명화 방식(비-i18n 기술 요약)
}

const FEATURE_FIELDS = [
  "nationality",
  "gender",
  "ageBand",
  "faceShape",
  "crownVolume",
  "hairDensity",
  "hairType",
  "concernIds",
  "allergy",
  "serviceIds",
  "products",
  "stateGrade",
  "hairStateScore",
  "satisfactionScore",
  "nextVisitWeeks",
];

const EXCLUDED_PII = [
  "phone",
  "name",
  "free-text notes",
  "selfie / face photo",
];

export async function getTrainingDataStatus(): Promise<TrainingDataStatus> {
  const repo = getRepo();
  const [sampleCount, photo, consultations] = await Promise.all([
    repo.countTrainingSamples().catch(() => 0),
    repo
      .countTrainingPhotosByKind()
      .catch(() => ({ before: 0, after: 0, style: 0 })),
    repo.listConsultations({ limit: 5000 }),
  ]);

  const completed = consultations.filter((c) => c.status === "completed");
  const trainingConsented = completed.filter(
    (c) => !!c.intake.trainingConsentedAt,
  ).length;
  const photoConsented = completed.filter(
    (c) => !!c.intake.photoTrainingConsentedAt,
  ).length;
  const denom = completed.length || 1;

  return {
    sampleCount,
    photo: {
      ...photo,
      total: photo.before + photo.after + photo.style,
    },
    completedConsults: completed.length,
    trainingConsented,
    photoConsented,
    trainingConsentRate: trainingConsented / denom,
    photoConsentRate: photoConsented / denom,
    featureFields: FEATURE_FIELDS,
    excludedPii: EXCLUDED_PII,
    pseudonymNote: "SHA-256(customerId + entrySecret) · 32 hex · salted, irreversible",
  };
}
