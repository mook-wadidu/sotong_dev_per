"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Button,
  Checkbox,
  Divider,
  FormField,
  Input,
  MobileFrame,
  ProgressSteps,
  RadioGroup,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  SectionLabel,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
  ToggleGroup,
  toast,
  type RadioOption,
  type ToggleOption,
} from "@/components/ui";
import {
  CONCERNS,
  CROWN_VOLUME,
  FACE_SHAPES,
  formatPrice,
  HAIR_DENSITY,
  HAIR_TYPE,
} from "@/lib/catalog";
import { submitIntake } from "@/lib/actions";
import {
  getServiceCategoryIcon,
  getFaceShapeIcon,
  getConcernIcon,
  getTreatmentTypeIcon,
  SpinnerIcon,
} from "@/components/icons";
import { customerThreadPath } from "@/lib/links";
import {
  emptyIntake,
  type CustomerHairProfile,
  type FaceShape,
  type IntakeDraft,
  type Locale,
  type LocalizedText,
  type ThreeLevel,
  type HairType,
  type TreatmentType,
  type TreatmentRecency,
  type YesNoUnknown,
} from "@/lib/domain/types";
import { resizeImageToDataUrl } from "./resize-image";

const TOTAL_STEPS = 8;
const MAX_PHOTOS = 5;

/** 살롱별 메뉴(서버에서 해석한 가격 포함) — 전역 catalog 대체 */
export interface IntakeMenuCategory {
  id: string;
  label: LocalizedText;
  sort: number;
}
export interface IntakeMenuService {
  id: string;
  categoryId: string;
  label: LocalizedText;
  priceFrom: number;
}

/** 시술 타입/시기 옵션 (다국어) — 최근 시술 이력 빌더 */
const TREATMENT_TYPES: { id: TreatmentType; label: LocalizedText }[] = [
  { id: "cut", label: { ko: "컷", ja: "カット", en: "Cut", zh: "剪发" } },
  { id: "perm", label: { ko: "펌", ja: "パーマ", en: "Perm", zh: "烫发" } },
  { id: "color", label: { ko: "염색", ja: "カラー", en: "Color", zh: "染发" } },
  { id: "care", label: { ko: "클리닉/케어", ja: "ケア", en: "Care", zh: "护理" } },
];
const TREATMENT_RECENCIES: {
  id: TreatmentRecency;
  label: LocalizedText;
}[] = [
  { id: "2w", label: { ko: "2주 내", ja: "2週間以内", en: "Within 2 weeks", zh: "2周内" } },
  { id: "1m", label: { ko: "1개월 내", ja: "1ヶ月以内", en: "Within 1 month", zh: "1个月内" } },
  { id: "3m", label: { ko: "3개월 내", ja: "3ヶ月以内", en: "Within 3 months", zh: "3个月内" } },
  { id: "older", label: { ko: "그 이전", ja: "それ以前", en: "Earlier", zh: "更早之前" } },
];
const COWLICK_OPTIONS: { id: YesNoUnknown; key: string }[] = [
  { id: "yes", key: "yes" },
  { id: "no", key: "no" },
  { id: "unknown", key: "unknown" },
];

/** 서버(getReturningContext)가 넘기는 재방문 프리필 컨텍스트. */
export interface ReturningContext {
  isReturning: boolean;
  profile?: CustomerHairProfile;
  lastServiceIds?: string[];
  lastVisitedAt?: string;
}

/**
 * 재방문 프리필 — 지난 모발 프로필 + 마지막 시술을 emptyIntake 위에 덮어쓴다.
 * 안 변하는 프로필 부분집합만 채우고, 사진/연락처/동의/메모성 1회성 입력은 비워 둔다
 * (styleNote/concernNote 는 매번 달라질 수 있으니 프리필 제외 — 손님이 새로 적게).
 * lastServiceIds 는 살롱 메뉴에 아직 존재하는 id 만 남긴다.
 */
function prefilledDraft(
  ctx: ReturningContext,
  services: IntakeMenuService[],
): IntakeDraft {
  const base = emptyIntake();
  const p = ctx.profile;
  const validIds = new Set(services.map((s) => s.id));
  const serviceIds = (ctx.lastServiceIds ?? []).filter((id) => validIds.has(id));
  return {
    ...base,
    serviceIds,
    faceShape: p?.faceShape ?? base.faceShape,
    crownVolume: p?.crownVolume ?? base.crownVolume,
    hairDensity: p?.hairDensity ?? base.hairDensity,
    hairType: p?.hairType ?? base.hairType,
    cowlickWhorl: p?.cowlickWhorl ?? base.cowlickWhorl,
    cowlickSticking: p?.cowlickSticking ?? base.cowlickSticking,
    treatmentHistory: p?.treatmentHistory ?? base.treatmentHistory,
    concernIds: p?.concernIds ?? base.concernIds,
    allergy: p?.allergy ?? base.allergy,
    allergyNote: p?.allergyNote ?? base.allergyNote,
  };
}

export function IntakeStepper({
  entryToken,
  locale,
  salonName,
  categories,
  services,
  returning,
}: {
  entryToken: string;
  locale: Locale;
  salonName: string;
  categories: IntakeMenuCategory[];
  services: IntakeMenuService[];
  returning?: ReturningContext;
}) {
  const t = useTranslations("Customer");
  const router = useRouter();

  // 재방문(기기 토큰 매칭)이면 인테이크 전에 분기 화면("지난번처럼 / 새 스타일")을 띄운다.
  const isReturning = !!returning?.isReturning;
  // "지난번처럼"을 고르기 전까지는 분기 화면(intro)에서 대기. 신규는 곧장 스텝 1.
  const [phase, setPhase] = React.useState<"intro" | "form">(
    isReturning ? "intro" : "form",
  );
  // "지난번처럼"으로 들어왔는지 — 프리필 + 프로필 재질문 스킵 옵션 노출에 사용.
  const [prefilled, setPrefilled] = React.useState(false);

  const [step, setStep] = React.useState(1);
  const [draft, setDraft] = React.useState<IntakeDraft>(() => emptyIntake());
  const [consent, setConsent] = React.useState(false);
  const [consentError, setConsentError] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  // "지난번처럼" — 프리필 후 폼 진입. "새 스타일" — 빈 폼으로 진입.
  const startSameAsBefore = () => {
    if (returning) setDraft(prefilledDraft(returning, services));
    setPrefilled(true);
    setStep(1);
    setPhase("form");
  };
  const startNewStyle = () => {
    setDraft(emptyIntake());
    setPrefilled(false);
    setStep(1);
    setPhase("form");
  };

  const patch = React.useCallback(
    (p: Partial<IntakeDraft>) => setDraft((d) => ({ ...d, ...p })),
    [],
  );

  // 단계 이동(또는 intro→form 전환) 시 본문 스크롤 위 + 제목으로 포커스 이동 (a11y).
  // phase 도 의존성에 넣어, 이미 step 1 인 상태로 폼에 진입해도 새 제목으로 포커스가 간다.
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
    titleRef.current?.focus();
  }, [step, phase]);

  const canSubmit = draft.serviceIds.length >= 1 && consent;

  const goNext = () => {
    if (step === 1 && draft.serviceIds.length < 1) {
      toast.error(t("intake.needService"));
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };
  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const onSubmit = async () => {
    if (draft.serviceIds.length < 1) {
      setStep(1);
      toast.error(t("intake.needService"));
      return;
    }
    if (!consent) {
      setConsentError(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitIntake({
        entryToken,
        // 서버(startConsultation)가 기기 토큰으로 최종 판정하므로 이 값은 참고용.
        // 그래도 클라가 아는 한 진실한 값(재방문 컨텍스트)을 보낸다.
        customerLocale: locale,
        isReturning,
        intake: { ...draft, consentedAt: new Date().toISOString() },
      });
      toast.success(t("intake.submitted"));
      router.replace(customerThreadPath(res.consultationToken, locale));
    } catch {
      setSubmitting(false);
      toast.error(t("intake.submitError"));
    }
  };

  const stepTitleKey = STEP_TITLE_KEYS[step - 1];

  // 재방문 분기 화면 — "지난번처럼 / 새 스타일" 선택 전까지 폼을 가린다.
  if (phase === "intro") {
    const lastVisit = returning?.lastVisitedAt
      ? formatLastVisit(returning.lastVisitedAt, locale)
      : undefined;
    return (
      <MobileFrame tone="muted">
        <ScreenHeader title={salonName} />
        <ScreenBody className="flex flex-1 flex-col justify-center space-y-5 pb-6">
          <div className="space-y-1.5">
            <h1
              ref={titleRef}
              tabIndex={-1}
              className="text-2xl font-bold leading-snug tracking-tight text-foreground outline-none"
            >
              {t("intake.returning.title")}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("intake.returning.subtitle")}
            </p>
            {lastVisit ? (
              <p className="text-xs font-medium tabular-nums text-muted-foreground">
                {t("intake.returning.lastVisit", { date: lastVisit })}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={startSameAsBefore}
              className="w-full rounded-2xl border-2 border-foreground bg-card px-5 py-4 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <p className="text-base font-bold text-foreground">
                {t("intake.returning.sameAsBefore")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("intake.returning.sameHint")}
              </p>
            </button>
            <button
              type="button"
              onClick={startNewStyle}
              className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <p className="text-base font-bold text-foreground">
                {t("intake.returning.newStyle")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("intake.returning.newHint")}
              </p>
            </button>
          </div>
        </ScreenBody>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame tone="muted">
      <ScreenHeader
        title={salonName}
        leading={
          step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("intake.back")}
            </button>
          ) : undefined
        }
      />

      <div className="space-y-1.5 px-4 pt-3">
        <ProgressSteps
          total={TOTAL_STEPS}
          current={step}
          label={t("intake.title")}
          valueText={t("intake.stepOf", { current: step, total: TOTAL_STEPS })}
        />
        {/* 가시 단계 카운터 — 막대만으로는 8스텝 길이 인지가 약함(AUDIT UX P2). */}
        <p className="text-right text-xs font-medium tabular-nums text-muted-foreground">
          {t("intake.stepOf", { current: step, total: TOTAL_STEPS })}
        </p>
      </div>

      <ScreenBody className="space-y-5 pb-6">
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="text-lg font-bold leading-snug text-foreground outline-none"
        >
          {t(stepTitleKey)}
        </h1>

        {/* "지난번처럼" 진입 시 프리필 안내 — 바뀐 부분만 고치면 된다고 알림. */}
        {prefilled ? (
          <p className="-mt-2 rounded-xl border border-border bg-accent-soft/60 px-3.5 py-2.5 text-sm leading-relaxed text-accent-text">
            {t("intake.returning.prefilled")}
          </p>
        ) : null}

        {step === 1 && (
          <ServicesStep
            t={t}
            locale={locale}
            draft={draft}
            patch={patch}
            categories={categories}
            services={services}
          />
        )}
        {step === 2 && <PhotosStep t={t} draft={draft} patch={patch} />}
        {step === 3 && (
          <FaceHairStep t={t} locale={locale} draft={draft} patch={patch} />
        )}
        {step === 4 && (
          <HistoryStep t={t} locale={locale} draft={draft} patch={patch} />
        )}
        {step === 5 && (
          <ConcernStep t={t} locale={locale} draft={draft} patch={patch} />
        )}
        {step === 6 && <AllergyStep t={t} draft={draft} patch={patch} />}
        {step === 7 && <PhoneStep t={t} draft={draft} patch={patch} />}
        {step === 8 && (
          <ConsentStep
            t={t}
            consent={consent}
            error={consentError}
            onChange={(v) => {
              setConsent(v);
              if (v) setConsentError(false);
            }}
          />
        )}
      </ScreenBody>

      <ScreenFooter>
        {step < TOTAL_STEPS ? (
          <Button
            variant="accent"
            size="xl"
            className="w-full"
            onClick={goNext}
          >
            {/* 사진 스텝: 0장이면 '사진 없이 진행', 1장 이상이면 '다음' */}
            {step === 2 && draft.stylePhotoUrls.length === 0
              ? t("intake.photos.skip")
              : t("intake.next")}
          </Button>
        ) : (
          <Button
            variant="accent"
            size="xl"
            className="w-full"
            disabled={!canSubmit || submitting}
            onClick={onSubmit}
          >
            {submitting ? (
              <>
                <SpinnerIcon className="size-5 animate-spin" aria-hidden="true" />
                {t("intake.submitting")}
              </>
            ) : (
              t("intake.submit")
            )}
          </Button>
        )}
      </ScreenFooter>
    </MobileFrame>
  );
}

type T = ReturnType<typeof useTranslations<"Customer">>;
type Patch = (p: Partial<IntakeDraft>) => void;

const INTL_LOCALE: Record<Locale, string> = {
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
  zh: "zh-CN",
};

/** 지난 방문일(ISO)을 손님 로케일로 — 날짜만. 잘못된 입력이면 빈 문자열. */
function formatLastVisit(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

const STEP_TITLE_KEYS = [
  "intake.step.services",
  "intake.step.photos",
  "intake.step.face",
  "intake.step.hair",
  "intake.concern.title",
  "intake.step.allergy",
  "intake.step.phone",
  "intake.step.consent",
] as const;

/* ── ① 시술 (다중, 살롱별 카테고리·가격) + 스타일 메모 ─────── */
function ServicesStep({
  t,
  locale,
  draft,
  patch,
  categories,
  services,
}: {
  t: T;
  locale: Locale;
  draft: IntakeDraft;
  patch: Patch;
  categories: IntakeMenuCategory[];
  services: IntakeMenuService[];
}) {
  const priceMap = React.useMemo(
    () => new Map(services.map((s) => [s.id, s.priceFrom])),
    [services],
  );
  const priceWon = draft.serviceIds.reduce(
    (sum, id) => sum + (priceMap.get(id) ?? 0),
    0,
  );
  const hasPrice = draft.serviceIds.some((id) => priceMap.has(id));
  const sortedCats = [...categories].sort((a, b) => a.sort - b.sort);

  return (
    <div className="space-y-5">
      <p className="-mt-2 text-sm text-muted-foreground">
        {t("intake.services.hint")}
      </p>
      {sortedCats.map((cat) => {
        const catServices = services.filter((s) => s.categoryId === cat.id);
        if (catServices.length === 0) return null;
        const CatIcon = getServiceCategoryIcon(cat.id);
        return (
          <div key={cat.id} className="space-y-2">
            <SectionLabel className="mb-1.5 flex items-center gap-1.5">
              {CatIcon ? <CatIcon className="size-4 text-foreground" /> : null}
              {cat.label[locale] ?? cat.label.ko}
            </SectionLabel>
            <ToggleGroup
              label={cat.label[locale] ?? cat.label.ko}
              options={catServices.map<ToggleOption<string>>((s) => ({
                value: s.id,
                label: s.label[locale] ?? s.label.ko,
                sublabel: s.priceFrom
                  ? formatPrice(s.priceFrom, locale)
                  : undefined,
                icon: CatIcon ? <CatIcon /> : undefined,
              }))}
              value={draft.serviceIds}
              onValueChange={(ids) => patch({ serviceIds: ids })}
            />
          </div>
        );
      })}

      {/* 예상 가격 요약 (sticky 느낌의 카드) */}
      <div className="rounded-xl border border-border bg-accent-soft/60 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">
          {t("intake.services.estimate")}
        </p>
        <p className="mt-0.5 text-lg font-bold text-accent-text">
          {hasPrice
            ? formatPrice(priceWon, locale)
            : t("intake.services.estimateNone")}
        </p>
      </div>

      {/* 원하는 스타일 자유 메모 (손님 언어, 요약에 번역 반영) */}
      <div className="space-y-1.5">
        <SectionLabel className="mb-1">{t("intake.services.styleNote")}</SectionLabel>
        <Textarea
          value={draft.styleNote ?? ""}
          onChange={(e) => patch({ styleNote: e.target.value })}
          placeholder={t("intake.services.styleNotePlaceholder")}
          aria-label={t("intake.services.styleNote")}
        />
      </div>
    </div>
  );
}

/* ── ② 스타일 사진 (0..n, 클라 리사이즈) ───────────────── */
function PhotosStep({ t, draft, patch }: { t: T; draft: IntakeDraft; patch: Patch }) {
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const photos = draft.stylePhotoUrls;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const picked = Array.from(files).slice(0, Math.max(0, room));
      const urls: string[] = [];
      let failed = 0;
      for (const f of picked) {
        try {
          urls.push(await resizeImageToDataUrl(f));
        } catch {
          failed += 1;
        }
      }
      if (urls.length) patch({ stylePhotoUrls: [...photos, ...urls] });
      // 파일마다 토스트를 띄우지 않고 1회로 집계(AUDIT UX P2) — 부분 누락 인지 쉽게.
      if (failed > 0) {
        toast.error(
          t("intake.photos.someFailed", { failed, total: picked.length }),
        );
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (i: number) =>
    patch({ stylePhotoUrls: photos.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <p className="-mt-2 text-sm text-muted-foreground">
        {t("intake.photos.hint")}
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        {photos.map((url, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
          >
            {/* 인테이크 미리보기 — 다음 next/image 비대상(dataURL) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${t("intake.step.photos")} ${i + 1}`}
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t("intake.photos.remove")}
              className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-foreground/65 text-base font-semibold leading-none text-card outline-none backdrop-blur-sm transition-colors hover:bg-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          >
            {busy ? (
              <SpinnerIcon className="size-6 animate-spin" aria-hidden="true" />
            ) : (
              <span
                className="text-2xl font-light leading-none"
                aria-hidden="true"
              >
                +
              </span>
            )}
            <span className="text-xs font-medium">
              {busy ? t("intake.photos.uploading") : t("intake.photos.add")}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}

/* ── ③ 얼굴형(단일 그리드) + 두상/머리숱/모질(단일 각각) ── */
function FaceHairStep({
  t,
  locale,
  draft,
  patch,
}: {
  t: T;
  locale: Locale;
  draft: IntakeDraft;
  patch: Patch;
}) {
  const faceOpts = FACE_SHAPES.map((f) => {
    const FaceIcon = getFaceShapeIcon(f.id);
    return {
      value: f.id,
      label: f.label[locale] ?? f.label.ko,
      icon: FaceIcon ? <FaceIcon /> : undefined,
    };
  });
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="-mt-2 text-sm text-muted-foreground">
          {t("intake.face.hint")}
        </p>
        <RadioGroup
          variant="grid"
          label={t("intake.step.face")}
          options={faceOpts}
          value={(draft.faceShape as FaceShape | undefined) ?? null}
          onValueChange={(v) => patch({ faceShape: v as FaceShape })}
        />
      </div>

      <Divider />

      <LevelRadio
        label={t("intake.hair.crownVolume")}
        items={CROWN_VOLUME}
        locale={locale}
        value={draft.crownVolume ?? null}
        onChange={(v) => patch({ crownVolume: v as ThreeLevel })}
      />
      <LevelRadio
        label={t("intake.hair.density")}
        items={HAIR_DENSITY}
        locale={locale}
        value={draft.hairDensity ?? null}
        onChange={(v) => patch({ hairDensity: v as ThreeLevel })}
      />
      <LevelRadio
        label={t("intake.hair.type")}
        items={HAIR_TYPE}
        locale={locale}
        value={draft.hairType ?? null}
        onChange={(v) => patch({ hairType: v as HairType })}
      />

      <Divider />

      {/* 가마 / 뻗침 (컷·스타일링 참고) */}
      <div className="space-y-2">
        <SectionLabel className="mb-1.5">{t("intake.hair.cowlickWhorl")}</SectionLabel>
        <RadioGroup
          variant="grid"
          label={t("intake.hair.cowlickWhorl")}
          options={COWLICK_OPTIONS.map((o) => ({
            value: o.id,
            label: t(`intake.hair.cowlick.${o.key}`),
          }))}
          value={draft.cowlickWhorl ?? null}
          onValueChange={(v) => patch({ cowlickWhorl: v as YesNoUnknown })}
        />
      </div>
      <div className="space-y-2">
        <SectionLabel className="mb-1.5">{t("intake.hair.cowlickSticking")}</SectionLabel>
        <RadioGroup
          variant="grid"
          label={t("intake.hair.cowlickSticking")}
          options={COWLICK_OPTIONS.map((o) => ({
            value: o.id,
            label: t(`intake.hair.cowlick.${o.key}`),
          }))}
          value={draft.cowlickSticking ?? null}
          onValueChange={(v) => patch({ cowlickSticking: v as YesNoUnknown })}
        />
      </div>
    </div>
  );
}

function LevelRadio({
  label,
  items,
  locale,
  value,
  onChange,
}: {
  label: string;
  items: { id: string; label: LocalizedText }[];
  locale: Locale;
  value: string | null;
  onChange: (v: string) => void;
}) {
  const opts: RadioOption<string>[] = items.map((i) => ({
    value: i.id,
    label: i.label[locale] ?? i.label.ko,
  }));
  return (
    <div className="space-y-2">
      <SectionLabel className="mb-1.5">{label}</SectionLabel>
      <RadioGroup
        variant="grid"
        label={label}
        options={opts}
        value={value}
        onValueChange={onChange}
      />
    </div>
  );
}

/* ── ④ 최근 시술 이력 (타입 다중 + 선택 타입별 시기) ─────── */
function HistoryStep({
  t,
  locale,
  draft,
  patch,
}: {
  t: T;
  locale: Locale;
  draft: IntakeDraft;
  patch: Patch;
}) {
  // 선택한 시술 타입 → 시기 선택 노출. type 토글로 추가/제거.
  const selectedTypes = draft.treatmentHistory.map((h) => h.type);

  const toggleType = (type: TreatmentType, on: boolean) => {
    if (on) {
      if (selectedTypes.includes(type)) return;
      patch({
        treatmentHistory: [
          ...draft.treatmentHistory,
          { type, recency: "1m" as TreatmentRecency },
        ],
      });
    } else {
      patch({
        treatmentHistory: draft.treatmentHistory.filter((h) => h.type !== type),
      });
    }
  };

  const setRecency = (type: TreatmentType, recency: TreatmentRecency) => {
    patch({
      treatmentHistory: draft.treatmentHistory.map((h) =>
        h.type === type ? { ...h, recency } : h,
      ),
    });
  };

  return (
    <div className="space-y-3">
      <p className="-mt-2 mb-1 text-sm text-muted-foreground">
        {t("intake.hair.historyHint")}
      </p>
      <ToggleGroup
        label={t("intake.hair.history")}
        options={TREATMENT_TYPES.map<ToggleOption<TreatmentType>>((tt) => {
          const TypeIcon = getTreatmentTypeIcon(tt.id);
          return {
            value: tt.id,
            label: tt.label[locale] ?? tt.label.ko,
            icon: TypeIcon ? <TypeIcon /> : undefined,
          };
        })}
        value={selectedTypes}
        onValueChange={(types) => {
          // 추가/제거를 diff 로 반영
          const set = new Set(types);
          for (const tt of TREATMENT_TYPES) {
            const on = set.has(tt.id);
            const was = selectedTypes.includes(tt.id);
            if (on !== was) toggleType(tt.id, on);
          }
        }}
      />

      {/* 선택한 시술별 시기(recency) 선택 */}
      {draft.treatmentHistory.map((h) => {
        const typeItem = TREATMENT_TYPES.find((x) => x.id === h.type);
        const typeLabel = typeItem?.label[locale] ?? typeItem?.label.ko ?? h.type;
        return (
          <div
            key={h.type}
            className="space-y-1.5 rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <p className="text-sm font-medium text-foreground">
              {t("intake.hair.historyRecency", { type: typeLabel })}
            </p>
            <RadioGroup
              variant="grid"
              label={t("intake.hair.historyRecency", { type: typeLabel })}
              options={TREATMENT_RECENCIES.map<RadioOption<string>>((r) => ({
                value: r.id,
                label: r.label[locale] ?? r.label.ko,
              }))}
              value={h.recency}
              onValueChange={(v) => setRecency(h.type, v as TreatmentRecency)}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ── ⑤ 고민 (별도 스텝: 칩 다중 + 자유 서술 메모, 건너뛰기) ── */
function ConcernStep({
  t,
  locale,
  draft,
  patch,
}: {
  t: T;
  locale: Locale;
  draft: IntakeDraft;
  patch: Patch;
}) {
  return (
    <div className="space-y-4">
      <p className="-mt-2 text-sm text-muted-foreground">
        {t("intake.concern.hint")}
      </p>
      <ToggleGroup
        variant="grid"
        label={t("intake.concern.title")}
        options={CONCERNS.map<ToggleOption<string>>((c) => {
          const ConcernIcon = getConcernIcon(c.id);
          return {
            value: c.id,
            label: c.label[locale] ?? c.label.ko,
            icon: ConcernIcon ? <ConcernIcon /> : undefined,
          };
        })}
        value={draft.concernIds}
        onValueChange={(ids) => patch({ concernIds: ids })}
      />
      <Textarea
        value={draft.concernNote ?? ""}
        onChange={(e) => patch({ concernNote: e.target.value })}
        placeholder={t("intake.concern.notePlaceholder")}
        aria-label={t("intake.concern.notePlaceholder")}
      />
    </div>
  );
}

/* ── ⑥ 알레르기 (예/아니오 + 메모) ─────────────────────── */
function AllergyStep({ t, draft, patch }: { t: T; draft: IntakeDraft; patch: Patch }) {
  return (
    <div className="space-y-4">
      <RadioGroup
        label={t("intake.allergy.question")}
        options={[
          { value: "yes", label: t("intake.allergy.has") },
          { value: "no", label: t("intake.allergy.none") },
        ]}
        value={draft.allergy ? "yes" : "no"}
        onValueChange={(v) =>
          patch({
            allergy: v === "yes",
            allergyNote: v === "yes" ? draft.allergyNote : undefined,
          })
        }
      />
      {draft.allergy && (
        <Textarea
          value={draft.allergyNote ?? ""}
          onChange={(e) => patch({ allergyNote: e.target.value })}
          placeholder={t("intake.allergy.notePlaceholder")}
          aria-label={t("intake.allergy.notePlaceholder")}
        />
      )}
    </div>
  );
}

/* ── ⑦ 전화 (선택, 이점 안내) + 연락처 없음 ──────────────── */
function PhoneStep({ t, draft, patch }: { t: T; draft: IntakeDraft; patch: Patch }) {
  return (
    <div className="space-y-4">
      {/* 번호를 남기는 이점 안내 */}
      <div className="rounded-xl border border-border bg-accent-soft/60 px-4 py-3">
        <p className="text-sm leading-relaxed text-accent-text">
          {t("intake.phone.benefit")}
        </p>
      </div>
      <FormField label={t("intake.step.phone")} hint={t("intake.phone.hint")}>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t("intake.phone.placeholder")}
          value={draft.phone ?? ""}
          disabled={draft.contactOptOut}
          onChange={(e) => patch({ phone: e.target.value })}
        />
      </FormField>
      <Checkbox
        checked={draft.contactOptOut ?? false}
        onChange={(e) =>
          patch({
            contactOptOut: e.target.checked,
            phone: e.target.checked ? "" : draft.phone,
          })
        }
        label={t("intake.phone.optOut")}
      />
    </div>
  );
}

/* ── ⑧ 동의 (필수) + 상세 Sheet ──────────────────────── */
function ConsentStep({
  t,
  consent,
  error,
  onChange,
}: {
  t: T;
  consent: boolean;
  error: boolean;
  onChange: (v: boolean) => void;
}) {
  const tCommon = useTranslations("Common");
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-3">
      <Checkbox
        checked={consent}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={error ? true : undefined}
        label={t("intake.consent.label")}
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-accent-text underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t("intake.step.consent")}
      </button>

      {error && (
        <p className="text-xs font-medium text-destructive">
          {t("intake.consent.required")}
        </p>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent closeLabel={tCommon("close")}>
          <SheetHeader>
            <SheetTitle>{t("intake.step.consent")}</SheetTitle>
            <SheetDescription>{t("intake.consent.detail")}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("intake.consent.crossBorder")}
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {t("intake.consent.policyLink")}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
