"use client";

import * as React from "react";
import {
  Button,
  Checkbox,
  RadioGroup,
  SectionLabel,
  toast,
  type RadioOption,
} from "@/components/ui";
import {
  CROWN_VOLUME,
  FACE_SHAPES,
  HAIR_DENSITY,
  HAIR_TYPE,
} from "@/lib/catalog";
import { recordDesignerIntake } from "@/lib/actions";
import type {
  DesignerHairInput as DesignerHairInputT,
  FaceShape,
  HairType,
  ThreeLevel,
  YesNoUnknown,
} from "@/lib/domain/types";

/**
 * D2 요약 '디자이너 입력' 카드 — 손님 인테이크에서 옮겨온 신체정보(얼굴형·볼륨·머리숱·
 * 모질·가마·성별)를 디자이너가 보고/만져 판단해 입력 + 손님 자기보고 알레르기 재확인(안전).
 * 디자이너 뷰는 ko 고정이라 라벨은 한국어. 저장 시 consultation.designer_input 영속.
 * 신체정보 입력은 선택(완결 차단 X)이나 알레르기 경고는 호출부(요약)에서 항상 노출.
 */
const lv = (items: { id: string; label: { ko: string } }[]): RadioOption<string>[] =>
  items.map((i) => ({ value: i.id, label: i.label.ko }));

const YESNO: RadioOption<string>[] = [
  { value: "yes", label: "있음" },
  { value: "no", label: "없음" },
  { value: "unknown", label: "모름" },
];
const GENDER: RadioOption<string>[] = [
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
  { value: "other", label: "기타" },
];

export function DesignerHairInput({
  designerToken,
  initial,
  customerAllergy,
  customerAllergyNote,
}: {
  designerToken: string;
  initial?: DesignerHairInputT;
  /** 손님이 인테이크에서 자기보고한 알레르기 여부(재확인 대상). */
  customerAllergy?: boolean;
  customerAllergyNote?: string;
}) {
  const [v, setV] = React.useState<DesignerHairInputT>(initial ?? {});
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);

  const patch = (p: Partial<DesignerHairInputT>) => {
    setV((s) => ({ ...s, ...p }));
    setSaved(false);
  };

  const save = () => {
    startTransition(async () => {
      const res = await recordDesignerIntake(designerToken, v);
      if (res.ok) {
        setSaved(true);
        toast.success("디자이너 입력을 저장했어요");
      } else {
        toast.error("저장에 실패했어요. 다시 시도해 주세요.");
      }
    });
  };

  const faceOpts: RadioOption<string>[] = FACE_SHAPES.map((f) => ({
    value: f.id,
    label: f.label.ko,
  }));

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">디자이너 입력</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          보고/만져 판단한 항목 — 선택. 학습 데이터로 쌓여요.
        </p>
      </div>

      {/* 손님 자기보고 알레르기 재확인(안전) — 화학시술 게이팅이라 모노크롬 규칙의
          정당한 유일 예외로 **빨강** 허용(회색 경고는 바쁜 살롱에서 놓치기 쉬움, I). */}
      {customerAllergy ? (
        <div className="rounded-lg border-2 border-red-600 bg-red-50 p-3 dark:border-red-500 dark:bg-red-950/30">
          <p className="text-sm font-bold text-red-700 dark:text-red-400">
            ⚠ 손님 알레르기 있음
            {customerAllergyNote ? ` — ${customerAllergyNote}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            화학 약품 시술 전 반드시 확인 · 필요 시 패치테스트.
          </p>
          <div className="mt-2">
            <Checkbox
              checked={!!v.allergyConfirmedByDesigner}
              onChange={(e) =>
                patch({ allergyConfirmedByDesigner: e.target.checked })
              }
              label="확인했고 안전 조치(패치테스트 등) 안내함"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <SectionLabel className="mb-1.5">얼굴형</SectionLabel>
        <RadioGroup
          variant="grid"
          label="얼굴형"
          options={faceOpts}
          value={v.faceShape ?? null}
          onValueChange={(x) => patch({ faceShape: x as FaceShape })}
        />
      </div>

      <Field label="정수리 볼륨">
        <RadioGroup
          variant="grid"
          label="정수리 볼륨"
          options={lv(CROWN_VOLUME)}
          value={v.crownVolume ?? null}
          onValueChange={(x) => patch({ crownVolume: x as ThreeLevel })}
        />
      </Field>
      <Field label="머리숱">
        <RadioGroup
          variant="grid"
          label="머리숱"
          options={lv(HAIR_DENSITY)}
          value={v.hairDensity ?? null}
          onValueChange={(x) => patch({ hairDensity: x as ThreeLevel })}
        />
      </Field>
      <Field label="모질">
        <RadioGroup
          variant="grid"
          label="모질"
          options={lv(HAIR_TYPE)}
          value={v.hairType ?? null}
          onValueChange={(x) => patch({ hairType: x as HairType })}
        />
      </Field>
      <Field label="가마">
        <RadioGroup
          variant="grid"
          label="가마"
          options={YESNO}
          value={v.cowlickWhorl ?? null}
          onValueChange={(x) => patch({ cowlickWhorl: x as YesNoUnknown })}
        />
      </Field>
      <Field label="성별">
        <RadioGroup
          variant="grid"
          label="성별"
          options={GENDER}
          value={v.gender ?? null}
          onValueChange={(x) =>
            patch({ gender: x as NonNullable<DesignerHairInputT["gender"]> })
          }
        />
      </Field>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={save}
        disabled={pending}
      >
        {pending ? "저장 중…" : saved ? "✓ 저장됨" : "디자이너 입력 저장"}
      </Button>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <SectionLabel className="mb-1.5">{label}</SectionLabel>
      {children}
    </div>
  );
}
