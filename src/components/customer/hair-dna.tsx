import { createElement } from "react";
import { getFaceShapeIcon } from "@/components/icons";
import { faceShapeLabel } from "@/lib/catalog";
import type {
  Locale,
  FaceShape,
  ThreeLevel,
  HairType,
} from "@/lib/domain/types";

/**
 * 헤어 & 얼굴형 "DNA" — 모발 3축 삼각 레이더(볼륨·숱·웨이브) + 얼굴형 배지.
 * 값이 사람마다 달라 삼각형 모양이 고유 "DNA"처럼 보인다(리포트의 분석 시각요소).
 * 라이브러리 없이 SVG polygon. 값 없는 축은 중간(mid)으로 그려 형태를 유지.
 */
const LEVEL: Record<ThreeLevel, number> = { low: 0.34, mid: 0.67, high: 1 };
const WAVE: Record<HairType, number> = { straight: 0.34, wavy: 0.67, curly: 1 };

export function HairDna({
  hair,
  locale,
  labels,
}: {
  hair: {
    faceShape?: FaceShape;
    crownVolume?: ThreeLevel;
    hairDensity?: ThreeLevel;
    hairType?: HairType;
  };
  locale: Locale;
  labels: {
    title: string;
    volume: string;
    density: string;
    wave: string;
    faceShape: string;
  };
}) {
  const cx = 90;
  const cy = 94;
  const R = 60;
  const axes = [
    { v: hair.crownVolume ? LEVEL[hair.crownVolume] : 0.67, label: labels.volume, deg: -90 },
    { v: hair.hairDensity ? LEVEL[hair.hairDensity] : 0.67, label: labels.density, deg: 30 },
    { v: hair.hairType ? WAVE[hair.hairType] : 0.67, label: labels.wave, deg: 150 },
  ];
  const pt = (deg: number, rad: number): [number, number] => {
    const t = (deg * Math.PI) / 180;
    return [cx + R * rad * Math.cos(t), cy + R * rad * Math.sin(t)];
  };
  const guide = axes.map((a) => pt(a.deg, 1).join(",")).join(" ");
  const poly = axes.map((a) => pt(a.deg, a.v).join(",")).join(" ");

  // lowercase + createElement: react-hooks/static-components(렌더 중 컴포넌트 생성) 회피.
  const faceIcon = hair.faceShape ? getFaceShapeIcon(hair.faceShape) : undefined;
  const faceName = faceShapeLabel(hair.faceShape, locale);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-sm font-semibold text-foreground">
        {labels.title}
      </p>
      <div className="flex items-center justify-center gap-5">
        <svg viewBox="0 0 180 185" className="h-40 w-40 shrink-0" aria-hidden="true">
          <polygon
            points={guide}
            className="fill-none stroke-border"
            strokeWidth={1.5}
          />
          {axes.map((a, i) => {
            const [x, y] = pt(a.deg, 1);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
            );
          })}
          <polygon
            points={poly}
            className="fill-brand/20 stroke-brand"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {axes.map((a, i) => {
            const [x, y] = pt(a.deg, a.v);
            return <circle key={i} cx={x} cy={y} r={2.6} className="fill-brand" />;
          })}
          {axes.map((a, i) => {
            const [x, y] = pt(a.deg, 1.2);
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px] font-medium"
              >
                {a.label}
              </text>
            );
          })}
        </svg>

        {hair.faceShape ? (
          <div className="flex w-20 shrink-0 flex-col items-center gap-1 text-center">
            {faceIcon
              ? createElement(faceIcon, {
                  className: "size-12 text-foreground",
                })
              : null}
            <p className="text-xs text-muted-foreground">{labels.faceShape}</p>
            {faceName ? (
              <p className="text-sm font-semibold text-foreground">{faceName}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
