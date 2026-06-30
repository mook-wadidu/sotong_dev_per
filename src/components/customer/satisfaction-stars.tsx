"use client";

import * as React from "react";
import { StarIcon } from "@/components/icons";
import { saveSatisfactionRating } from "@/lib/actions";
import { toast } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * 손님 시술 만족도 별점(1~5).
 * - 손님(canRate): 탭하면 저장(treatment_record + training_sample). 손님 자기보고 = 학습 정답.
 * - 디자이너(readOnly): **입력 불가** — 손님이 남긴 결과만 읽기전용으로 표시(역할별 입력권한 명확화).
 * - demo: 저장 없이 표시만.
 */
export function SatisfactionStars({
  reportToken,
  labels,
  demo = false,
  readOnly = false,
  value = 0,
}: {
  reportToken: string;
  labels: { title: string; thanks: string; error: string; readOnly: string };
  demo?: boolean;
  /** 디자이너 읽기전용 — 별점 입력/저장 불가, 손님 결과만 표시. */
  readOnly?: boolean;
  /** 읽기전용 표시용 손님 점수(1~5). 0이면 미평가. */
  value?: number;
}) {
  const [score, setScore] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // ── 디자이너 읽기전용: 손님 평가 결과만, 탭/저장 핸들러 자체를 연결하지 않음 ──
  if (readOnly) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-sm font-semibold text-foreground">{labels.title}</p>
        <div className="flex gap-1" aria-label={`${value} / 5`} role="img">
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon
              key={n}
              className={cn(
                "size-9",
                n <= value
                  ? "fill-current text-brand"
                  : "text-muted-foreground/40",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{labels.readOnly}</p>
      </div>
    );
  }

  const submit = (n: number) => {
    if (saving || done) return;
    setScore(n);
    if (demo) {
      setDone(true);
      return;
    }
    setSaving(true);
    void saveSatisfactionRating(reportToken, n)
      .then((r) => {
        if (r?.ok) setDone(true);
        else {
          toast.error(labels.error);
          setScore(0);
        }
      })
      .catch(() => {
        toast.error(labels.error);
        setScore(0);
      })
      .finally(() => setSaving(false));
  };

  const active = hover || score;

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center">
      <p className="text-sm font-semibold text-foreground">
        {done ? labels.thanks : labels.title}
      </p>
      <div role="radiogroup" aria-label={labels.title} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={score === n}
            aria-label={`${n} / 5`}
            disabled={saving || done}
            onMouseEnter={() => !done && setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => !done && setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => submit(n)}
            className="rounded-full p-1 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-90 disabled:cursor-default motion-reduce:transition-none"
          >
            <StarIcon
              className={cn(
                "size-9",
                n <= active
                  ? "fill-current text-brand"
                  : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
