import type {
  DesignerSummary,
  HairReportDraft,
  Locale,
} from "@/lib/domain/types";
import { NATIONALITY_BY_LOCALE } from "@/lib/domain/types";
import type {
  AiProvider,
  ReportInput,
  SummarizeInput,
  TranslateInput,
} from "./types";

/**
 * MockProvider — 키 없이도 핵심 루프가 결정적으로 도는 규칙 기반 구현.
 * GEMINI_API_KEY 가 있으면 GeminiProvider 로 자동 대체된다(lib/ai/index.ts).
 * 실 번역 품질이 필요한 자유 텍스트는 작은 phrasebook + 원문 폴백으로 처리.
 */

/** mock 리포트 본문 테이블은 ko/ja/en 만 존재 — zh 등 미지원 로케일은 ko 로 폴백. */
function mockLocale(locale: Locale): "ko" | "ja" | "en" {
  return locale === "ja" || locale === "en" ? locale : "ko";
}

function nationalityWord(locale: SummarizeInput["customerLocale"]): string {
  const base = NATIONALITY_BY_LOCALE[locale];
  // 일본인/중국인처럼 "-인" 이 자연스러운 국적은 접미사로, 그 외는 "손님" 형으로.
  return locale === "ja" || locale === "zh" ? `${base}인` : `${base} 손님`;
}

export class MockProvider implements AiProvider {
  readonly name = "mock";

  async summarizeIntake(input: SummarizeInput): Promise<DesignerSummary> {
    const nationality = NATIONALITY_BY_LOCALE[input.customerLocale];
    const visit = input.isReturning ? "재방문" : "신규";
    const services = input.serviceLabelsKo;

    const cautionParts: string[] = [];
    if (input.treatmentHistoryLabelsKo.some((h) => h.includes("탈색"))) {
      cautionParts.push("탈색 이력(손상 주의)");
    }
    // 최근(2주 내) 시술이 있으면 시기 주의를 띄운다.
    if (input.treatmentHistoryLabelsKo.some((h) => h.includes("2주 내"))) {
      cautionParts.push("최근 시술(2주 내) — 모발 부담 주의");
    }
    if (input.intake.allergy) {
      cautionParts.push(
        input.allergyNote?.trim()
          ? `알레르기 있음(${input.allergyNote.trim()})`
          : "알레르기 있음",
      );
    }
    const cautions = cautionParts.join(", ") || "특이사항 없음";

    // 고민 칩 + 손님 작성 고민 메모(원문, mock 은 번역 없이 병기).
    const concerns =
      [
        input.concernLabelsKo.join(", ") || null,
        input.concernNote?.trim() ? `메모: ${input.concernNote.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" / ") || "없음";

    const styleDetailParts = [
      input.faceShapeKo && `${input.faceShapeKo} 얼굴형`,
      input.hairTypeKo,
      input.crownVolumeKo && `정수리 볼륨 ${input.crownVolumeKo}`,
      input.cowlickKo,
      input.styleNote?.trim() ? `스타일 메모: ${input.styleNote.trim()}` : null,
      input.intake.stylePhotoUrls.length
        ? `스타일 사진 ${input.intake.stylePhotoUrls.length}장`
        : null,
    ].filter(Boolean);
    const styleDetail = styleDetailParts.join(" · ") || "디테일 미입력";

    const headline = [
      `${nationalityWord(input.customerLocale)} ${visit}`,
      services.join("+") || "시술 미정",
      cautionParts[0],
      input.concernLabelsKo[0] && `${input.concernLabelsKo[0]} 고민`,
      input.estimatedPriceKo && `예상 ${input.estimatedPriceKo}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const raw = [
      `· 국적/언어: ${nationality} (${input.customerLocale})`,
      `· 구분: ${visit}`,
      `· 희망 시술: ${services.join(", ") || "미정"}`,
      `· 스타일: ${styleDetail}`,
      `· 최근 시술 이력: ${input.treatmentHistoryLabelsKo.join(", ") || "없음"}${
        cautionParts.length ? ` → ${cautions}` : ""
      }`,
      `· 고민: ${concerns}`,
      input.estimatedPriceKo ? `· 예상 가격: ${input.estimatedPriceKo}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      headline,
      nationality,
      isReturning: input.isReturning,
      services,
      styleDetail,
      hairCautions: cautions,
      concerns,
      estimatedPrice: input.estimatedPriceKo,
      raw,
    };
  }

  async translate(input: TranslateInput): Promise<string> {
    if (input.from === input.to) return input.text;
    const hit = lookupPhrase(input.text, input.to);
    // phrasebook 미스 → 원문 그대로 유지(번역 못 함을 표식하지 않고 원문 노출;
    // UI 가 원문 병기를 따로 처리). 실서비스 품질은 GeminiProvider 가 담당.
    return hit ?? input.text;
  }

  async draftReport(input: ReportInput): Promise<HairReportDraft> {
    // mock 리포트 본문 로컬라이즈 테이블은 ko/ja/en 만 채워져 있다. zh 는 4번째
    // 손님 언어로 추가 중이며 mock 데이터는 아직 없으므로 ko 피벗으로 폴백한다
    // (실 zh 리포트 품질은 GeminiProvider 가 담당). 이 narrowing 으로 zh 입력에서
    // undefined 인덱싱이 발생하지 않게 막는다.
    const locale = mockLocale(input.customerLocale);
    const services = input.summary.services; // 한국어 시술명(피벗)
    const isColor = services.some((s) => /염색|탈색|컬러/.test(s));
    const isPerm = services.some((s) => /펌/.test(s));

    const grade = input.record?.stateGrade ?? "mid";
    const score = grade === "high" ? 86 : grade === "mid" ? 68 : 52;

    // 디자이너가 기록한 product 는 service 단계에서 카탈로그 라벨로 로컬라이즈된다.
    // 기록이 없을 때만 mock 이 손님 로케일 기본 제품을 채운다(P1-27 손님 언어 생성).
    const products =
      input.record?.products && input.record.products.length
        ? input.record.products
        : DEFAULT_PRODUCTS[isColor ? "color" : "base"][locale];

    const homeCare: string[] = [];
    if (isColor) {
      homeCare.push(HOMECARE.colorNoWash[locale]);
      homeCare.push(HOMECARE.colorShampoo[locale]);
    }
    if (isPerm) {
      homeCare.push(HOMECARE.perm48[locale]);
    }
    homeCare.push(HOMECARE.weeklyTreatment[locale]);

    const nextVisitWeeks = isColor ? 6 : isPerm ? 10 : 5;

    return {
      // serviceSummary 본문을 손님 로케일로(시술명 자체는 카탈로그 피벗 한국어 유지;
      // 라벨 로컬라이즈는 service 레이어가 보강한다).
      serviceSummary: serviceSummaryLine(services, locale),
      products,
      hairStateGrade: grade,
      hairStateScore: score,
      homeCare,
      nextVisitWeeks,
    };
  }
}

/* ── 리포트 본문 로컬라이즈 테이블 (mock 결정적 생성, P1-27) ─────── */
type LText = Record<"ko" | "ja" | "en", string>;

function serviceSummaryLine(services: string[], locale: "ko" | "ja" | "en"): string {
  const joined = services.join(" + ");
  if (!joined) {
    return { ko: "시술", ja: "施術", en: "Service" }[locale];
  }
  switch (locale) {
    case "ja":
      return `本日の施術: ${joined}`;
    case "en":
      return `Today's service: ${joined}`;
    case "ko":
    default:
      return `오늘 시술: ${joined}`;
  }
}

const DEFAULT_PRODUCTS: Record<"color" | "base", Record<"ko" | "ja" | "en", string[]>> = {
  color: {
    ko: ["컬러 트리트먼트", "약산성 중화 트리트먼트"],
    ja: ["カラートリートメント", "弱酸性中和トリートメント"],
    en: ["Color treatment", "Acidic neutralizing treatment"],
  },
  base: {
    ko: ["모이스처 트리트먼트"],
    ja: ["モイスチャートリートメント"],
    en: ["Moisture treatment"],
  },
};

const HOMECARE: Record<string, LText> = {
  colorNoWash: {
    ko: "색 유지 위해 첫 3일은 샴푸를 피해주세요",
    ja: "色持ちのため、最初の3日間はシャンプーを控えてください",
    en: "Avoid shampooing for the first 3 days to keep the color",
  },
  colorShampoo: {
    ko: "컬러 전용(약산성) 샴푸 사용을 권장합니다",
    ja: "カラー専用（弱酸性）シャンプーのご使用をおすすめします",
    en: "We recommend using a color-care (mildly acidic) shampoo",
  },
  perm48: {
    ko: "펌 첫 48시간은 머리를 묶거나 강하게 누르지 마세요",
    ja: "パーマ後48時間は髪を結んだり強く押さえたりしないでください",
    en: "For the first 48 hours, don't tie up or press the perm firmly",
  },
  weeklyTreatment: {
    ko: "주 1~2회 트리트먼트로 손상을 관리하세요",
    ja: "週1〜2回のトリートメントでダメージケアをしてください",
    en: "Care for damage with a treatment 1–2 times a week",
  },
};

/* ── 작은 phrasebook (데모 스크립트용) ───────────────────── */
// zh 키는 아직 없음 — zh 타깃 조회는 자연히 미스 → 원문 폴백(translate 가 처리).
type Phrase = Partial<Record<Locale, string>>;
const PHRASEBOOK: Phrase[] = [
  { ko: "안녕하세요", ja: "こんにちは", en: "Hello" },
  { ko: "감사합니다", ja: "ありがとうございます", en: "Thank you" },
  { ko: "네", ja: "はい", en: "Yes" },
  { ko: "아니요", ja: "いいえ", en: "No" },
  {
    ko: "어깨 길이로 잘라주세요",
    ja: "肩までの長さで切ってください",
    en: "Please cut it to shoulder length",
  },
  {
    ko: "사진처럼 해주세요",
    ja: "写真のようにしてください",
    en: "Please make it like the photo",
  },
  {
    ko: "조금만 기다려 주세요",
    ja: "少々お待ちください",
    en: "Please wait a moment",
  },
  {
    ko: "너무 짧지 않게 해주세요",
    ja: "短くしすぎないでください",
    en: "Please don't make it too short",
  },
  {
    ko: "앞머리는 그대로 둘게요",
    ja: "前髪はそのままにします",
    en: "I'll leave the bangs as they are",
  },
];

function normalize(s: string): string {
  return s.trim().replace(/[。.!！?？\s]+$/u, "");
}

function lookupPhrase(text: string, to: Locale): string | null {
  const n = normalize(text);
  for (const p of PHRASEBOOK) {
    if (
      (p.ko && normalize(p.ko) === n) ||
      (p.ja && normalize(p.ja) === n) ||
      (p.en && normalize(p.en).toLowerCase() === n.toLowerCase())
    ) {
      return p[to] ?? null;
    }
  }
  return null;
}
