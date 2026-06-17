"use client";

import * as React from "react";
import { Spinner, toast } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { saveBeforePhoto } from "@/lib/actions";
import { resizeToDataUrl } from "@/lib/image";

type Labels = {
  /** 섹션 제목 — "(선택)" 포함 권장 */
  title: string;
  /** 보조 설명 */
  hint: string;
  /** 빈 슬롯 추가 버튼 */
  add: string;
  /** 다시 찍기 */
  retake: string;
  /** 저장 성공 토스트 */
  saved: string;
  /** 저장 실패 토스트 */
  failed: string;
  /** 썸네일 alt */
  alt: string;
  /** 이미 촬영됨 배지 */
  done: string;
};

/**
 * D2 — 요약 화면 '시술 전 사진(선택)' 촬영.
 * 카메라/파일 선택 → resizeToDataUrl → saveBeforePhoto 액션 저장.
 * 성공 시 썸네일 + '촬영됨' 표시. 선택사항이므로 미촬영도 정상 플로우.
 * record-form 의 PhotoSlot 스타일을 재사용한다.
 */
export function BeforePhotoCapture({
  designerToken,
  initialUrl,
  labels,
}: {
  designerToken: string;
  /** 이미 저장된 비포(getDesignerView.consultation.beforePhotoUrl) */
  initialUrl?: string;
  labels: Labels;
}) {
  const [url, setUrl] = React.useState<string | undefined>(initialUrl);
  const [pending, startTransition] = React.useTransition();

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let dataUrl: string;
    try {
      dataUrl = await resizeToDataUrl(file);
    } catch {
      toast.error(labels.failed);
      return;
    }
    startTransition(async () => {
      try {
        const { ok } = await saveBeforePhoto(designerToken, dataUrl);
        if (!ok) {
          toast.error(labels.failed);
          return;
        }
        setUrl(dataUrl);
        toast.success(labels.saved);
      } catch {
        toast.error(labels.failed);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-foreground">{labels.title}</p>
        {url ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
            <CheckIcon className="size-3" />
            {labels.done}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{labels.hint}</p>

      {url ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={labels.alt}
            className="size-24 rounded-xl border border-border object-cover"
          />
          <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
            {pending ? (
              <>
                <Spinner className="mr-1.5 text-current" /> {labels.retake}
              </>
            ) : (
              labels.retake
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={pending}
              onChange={onPick}
            />
          </label>
        </div>
      ) : (
        <label className="flex aspect-square w-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
          {pending ? (
            <Spinner className="text-current" />
          ) : (
            <span
              className="text-2xl font-light leading-none"
              aria-hidden="true"
            >
              +
            </span>
          )}
          <span className="text-xs">{labels.add}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={pending}
            onChange={onPick}
          />
        </label>
      )}
    </div>
  );
}
