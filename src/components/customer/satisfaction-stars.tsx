"use client";

import * as React from "react";
import { StarIcon } from "@/components/icons";
import { saveSatisfactionRating } from "@/lib/actions";
import { toast } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * 손님 시술 만족도 별점(1~5) — 리포트 하단. 탭하면 저장(treatment_record + training_sample).
 * 만족도는 디자이너 추정이 아니라 손님 자기보고(학습 정답 신호). demo=true 면 저장 없이 표시만.
 */
export function SatisfactionStars({
  reportToken,
  labels,
  demo = false,
}: {
  reportToken: string;
  labels: { title: string; thanks: string; error: string };
  demo?: boolean;
}) {
  const [score, setScore] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

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
