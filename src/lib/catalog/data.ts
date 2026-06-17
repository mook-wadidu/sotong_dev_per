import type {
  FaceShape,
  LocalizedText,
  QuickReplyIntent,
} from "@/lib/domain/types";

/**
 * 계층① 정적 카탈로그 — 한국어(ko) 기준 + ja/en 번역.
 * FE는 여기서 바로 읽고, Backend 에이전트는 이 내용으로 supabase/seed.sql 을 생성한다.
 * (두 곳의 id 는 반드시 일치시킬 것)
 */

export interface CatalogItem {
  id: string;
  label: LocalizedText;
  /** (Phase 3 흑백·텍스트 전용) 픽토그램 미사용 — 텍스트 라벨만 렌더. 하위호환 위해 옵셔널 유지. */
  icon?: string;
}

export interface ServiceItem extends CatalogItem {
  categoryId: string;
  priceFrom?: number; // KRW, 예상가 계산용
}

export interface ServiceCategory extends CatalogItem {
  services: ServiceItem[];
}

const L = (ko: string, ja: string, en: string): LocalizedText => ({
  ko,
  ja,
  en,
});

/* ── 시술 카탈로그 (§9.1) ───────────────────────────────── */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "cut",
    label: L("컷", "カット", "Cut"),
    services: [
      {
        id: "cut_women",
        categoryId: "cut",
        label: L("여성 컷", "レディースカット", "Women's Cut"),
        priceFrom: 35000,
      },
      {
        id: "cut_men",
        categoryId: "cut",
        label: L("남성 컷", "メンズカット", "Men's Cut"),
        priceFrom: 28000,
      },
    ],
  },
  {
    id: "perm",
    label: L("펌", "パーマ", "Perm"),
    services: [
      {
        id: "perm_general",
        categoryId: "perm",
        label: L("일반 펌", "パーマ", "Perm"),
        priceFrom: 80000,
      },
      {
        id: "perm_digital",
        categoryId: "perm",
        label: L("디지털 펌", "デジタルパーマ", "Digital Perm"),
        priceFrom: 120000,
      },
    ],
  },
  {
    id: "color",
    label: L("염색", "カラー", "Color"),
    services: [
      {
        id: "color_full",
        categoryId: "color",
        label: L("전체 염색", "フルカラー", "Full Color"),
        priceFrom: 90000,
      },
      {
        id: "color_root",
        categoryId: "color",
        label: L("뿌리 염색", "リタッチ", "Root Touch-up"),
        priceFrom: 60000,
      },
      {
        id: "color_point",
        categoryId: "color",
        label: L("포인트 염색", "ポイントカラー", "Point Color"),
        priceFrom: 70000,
      },
      {
        id: "color_bleach",
        categoryId: "color",
        label: L("탈색", "ブリーチ", "Bleach"),
        priceFrom: 100000,
      },
    ],
  },
  {
    id: "clinic",
    label: L("클리닉", "トリートメント", "Clinic"),
    services: [
      {
        id: "clinic_treatment",
        categoryId: "clinic",
        label: L("트리트먼트", "トリートメント", "Treatment"),
        priceFrom: 50000,
      },
    ],
  },
  {
    id: "styling",
    label: L("스타일링", "スタイリング", "Styling"),
    services: [
      {
        id: "styling_dry",
        categoryId: "styling",
        label: L("드라이/스타일링", "ブロー/セット", "Blow-dry / Styling"),
        priceFrom: 30000,
      },
      {
        id: "styling_magic",
        categoryId: "styling",
        label: L("매직/볼륨매직", "ストレートパーマ", "Straightening"),
        priceFrom: 90000,
      },
    ],
  },
];

export const ALL_SERVICES: ServiceItem[] = SERVICE_CATEGORIES.flatMap(
  (c) => c.services,
);

/* ── 얼굴형 (§9.2, 픽토그램 6종) ───────────────────────── */
export interface FaceShapeItem extends CatalogItem {
  id: FaceShape;
}
export const FACE_SHAPES: FaceShapeItem[] = [
  { id: "oval", label: L("계란형", "卵型", "Oval") },
  { id: "round", label: L("둥근형", "丸顔", "Round") },
  { id: "square", label: L("각진형", "ベース型", "Square") },
  { id: "long", label: L("긴형", "面長", "Long") },
  { id: "heart", label: L("하트형", "ハート型", "Heart") },
  { id: "diamond", label: L("다이아몬드형", "ひし形", "Diamond") },
];

/* ── 두상/머리숱/모질 (§9.3) ───────────────────────────── */
export const CROWN_VOLUME: CatalogItem[] = [
  { id: "high", label: L("볼륨 있음", "ボリュームあり", "High volume") },
  { id: "mid", label: L("보통", "普通", "Normal") },
  { id: "low", label: L("볼륨 없음", "ボリュームなし", "Flat") },
];
export const HAIR_DENSITY: CatalogItem[] = [
  { id: "high", label: L("많음", "多い", "Thick") },
  { id: "mid", label: L("보통", "普通", "Normal") },
  { id: "low", label: L("적음", "少ない", "Thin") },
];
export const HAIR_TYPE: CatalogItem[] = [
  { id: "straight", label: L("직모", "直毛", "Straight") },
  { id: "wavy", label: L("반곱슬", "くせ毛", "Wavy") },
  { id: "curly", label: L("곱슬", "強いくせ毛", "Curly") },
];

/* ── 모발 이력 (§9.4, 다중선택) ────────────────────────── */
export const HAIR_HISTORY: CatalogItem[] = [
  {
    id: "bleach_recent",
    label: L("6개월 내 탈색", "6ヶ月以内のブリーチ", "Bleached within 6 months"),
  },
  {
    id: "bleach_old",
    label: L("이전 탈색 이력", "以前のブリーチ", "Bleached before"),
  },
  { id: "perm_history", label: L("펌 이력", "パーマ履歴", "Perm history") },
  {
    id: "color_history",
    label: L("염색 이력", "カラー履歴", "Color history"),
  },
  {
    id: "straighten_history",
    label: L("매직/스트레이트닝", "縮毛矯正", "Straightening"),
  },
];

/* ── 평소 고민 (§9.5, 다중선택·건너뛰기 가능) ──────────── */
export const CONCERNS: CatalogItem[] = [
  { id: "no_volume", label: L("볼륨이 없어요", "ボリュームが出ない", "No volume") },
  { id: "frizzy", label: L("곱슬이 심해요", "くせが強い", "Very frizzy") },
  { id: "wide_forehead", label: L("이마가 넓어요", "おでこが広い", "Wide forehead") },
  { id: "sensitive_scalp", label: L("두피가 예민해요", "頭皮が敏感", "Sensitive scalp") },
  { id: "thin_hair", label: L("머리숱이 적어요", "髪が少ない", "Thin hair") },
  { id: "damaged", label: L("손상이 심해요", "ダメージが強い", "Very damaged") },
  { id: "gray_hair", label: L("흰머리를 가리고 싶어요", "白髪を隠したい", "Cover gray hair") },
  { id: "big_face", label: L("얼굴이 커 보여요", "顔が大きく見える", "Face looks big") },
];

/* ── 디자이너 퀵리플라이 칩 (§9.7, 사전 번역 고품질) ───── */
export interface QuickReply {
  /**
   * 칩 고유 식별자 — 동일 intent 가 여러 칩으로 존재(step_update 3종·closing 2종 등)하므로
   * 전송 시 어떤 칩인지 intent 만으로는 구분 불가. 서버는 replyId 로 정확 매칭한다(없으면 intent 폴백).
   */
  replyId: string;
  intent: QuickReplyIntent;
  /**
   * 디자이너가 보는 칩 라벨 — **항상 한국어 고정**.
   * 디자이너 UI 는 ko 고정(DESIGNER_LOCALE)이므로 이 라벨은 i18n(messages/*) 밖에 둔다.
   * 손님에게 가는 것은 chipLabel 이 아니라 message[손님 locale] 이다.
   */
  chipLabel: string;
  /** 손님이 받는 의미 — 사전 번역(ko/ja/en) */
  message: LocalizedText;
  /**
   * price/time 처럼 디자이너가 값을 채워야 하는 칩.
   * - price: 금액 → formatPrice(won, locale) 로 치환(손님 로케일 통화/숫자 포맷)
   * - time: TIME_PRESETS 의 분 단위 프리셋 라벨로 치환(자유 타이핑 금지, P0-11)
   * message 의 "{value}" 자리에 치환한다.
   */
  needsValue?: boolean;
  /** needsValue 가 시간 기반(TIME_PRESETS 사용)임을 표시 — 가격과 구분 */
  valueKind?: "price" | "time";
  /**
   * 스레드 입력 영역에 **인라인으로 항상 노출**되는 6개 핵심 칩(Phase 2).
   * true = 인라인. 미설정(나머지 11개) = "더보기" 시트에서 group 별로만 노출.
   */
  primary?: boolean;
  /**
   * "더보기" 시트에서 칩을 묶는 섹션. 인라인/시트 양쪽 모두 부여한다.
   * - greeting: 인사·자리안내·대기  - response: 가능/불가/제안/확인
   * - progress: 시술 진행 단계        - closing: 마무리 인사
   */
  group: "greeting" | "response" | "progress" | "closing";
}

export const QUICK_REPLIES: QuickReply[] = [
  /* — 인사 / 자리 안내 — */
  {
    replyId: "greeting",
    intent: "greeting",
    chipLabel: "어서오세요",
    message: L(
      "어서오세요! 곧 도와드릴게요",
      "いらっしゃいませ！すぐにご案内します",
      "Welcome! I'll help you in just a moment",
    ),
    primary: true,
    group: "greeting",
  },
  {
    replyId: "seat_guide",
    intent: "seat_guide",
    chipLabel: "자리 안내",
    message: L(
      "이쪽 자리로 안내해 드릴게요",
      "こちらのお席へご案内します",
      "Let me show you to your seat",
    ),
    group: "greeting",
  },
  {
    replyId: "be_right_there",
    intent: "be_right_there",
    chipLabel: "곧 갈게요",
    message: L(
      "잠시만요, 곧 갈게요",
      "少々お待ちください、すぐ伺います",
      "One moment, I'll be right there",
    ),
    group: "greeting",
  },
  /* — 가능 / 조건부 / 불가 — */
  {
    replyId: "available",
    intent: "available",
    chipLabel: "가능해요",
    message: L("네, 가능합니다", "はい、可能です", "Yes, we can do that"),
    primary: true,
    group: "response",
  },
  {
    replyId: "conditional",
    intent: "conditional",
    chipLabel: "조건부 가능",
    message: L(
      "가능은 한데, 머릿결 상태에 따라 결과가 달라질 수 있어요",
      "可能ですが、髪の状態によって仕上がりが変わることがあります",
      "We can do it, but the result may vary depending on your hair condition",
    ),
    group: "response",
  },
  {
    replyId: "decline",
    intent: "decline",
    chipLabel: "어려워요",
    message: L(
      "죄송하지만 오늘은 그 시술이 어려울 것 같아요",
      "申し訳ありませんが、本日はその施術は難しそうです",
      "I'm sorry, that service may not be possible today",
    ),
    group: "response",
  },
  {
    replyId: "checking",
    intent: "checking",
    chipLabel: "확인 중",
    message: L(
      "잠시 확인하고 알려드릴게요",
      "少し確認してからお知らせします",
      "Let me check and get right back to you",
    ),
    group: "response",
  },
  /* — 제안 / 추천 / 사진 — */
  {
    replyId: "alternative",
    intent: "alternative",
    chipLabel: "대안 제안",
    message: L(
      "이렇게 하는 건 어떠세요?",
      "こちらはいかがですか？",
      "How about this instead?",
    ),
    group: "response",
  },
  {
    replyId: "recommend",
    intent: "recommend",
    chipLabel: "추천드려요",
    message: L(
      "고객님께는 이 스타일을 추천드려요",
      "お客様にはこちらのスタイルがおすすめです",
      "I'd recommend this style for you",
    ),
    group: "response",
  },
  {
    replyId: "request_photo",
    intent: "request_photo",
    chipLabel: "사진 더",
    message: L(
      "원하는 스타일 사진을 더 보여주세요",
      "希望のスタイル写真をもっと見せてください",
      "Could you show more photos of the style you want?",
    ),
    primary: true,
    group: "response",
  },
  /* — 가격 / 시간 (값 입력) — */
  {
    replyId: "price",
    intent: "price",
    chipLabel: "가격 안내",
    message: L(
      "예상 가격은 {value} 입니다",
      "目安の料金は {value} です",
      "The estimated price is {value}",
    ),
    needsValue: true,
    valueKind: "price",
    primary: true,
    group: "response",
  },
  {
    replyId: "time",
    intent: "time",
    chipLabel: "소요시간",
    message: L(
      "약 {value} 걸립니다",
      "約 {value} かかります",
      "It takes about {value}",
    ),
    needsValue: true,
    valueKind: "time",
    primary: true,
    group: "response",
  },
  /* — 시술 진행 단계 안내 — */
  {
    replyId: "step_in_progress",
    intent: "step_update",
    chipLabel: "지금 진행 중",
    message: L(
      "지금 시술을 진행하고 있어요",
      "ただいま施術を進めています",
      "We're working on your service now",
    ),
    group: "progress",
  },
  {
    replyId: "step_finishing",
    intent: "step_update",
    chipLabel: "마무리 단계",
    message: L(
      "이제 마무리 단계예요, 거의 다 됐어요",
      "もうすぐ仕上げです、ほとんど完成です",
      "We're in the final step now, almost done",
    ),
    group: "progress",
  },
  {
    replyId: "step_almost",
    intent: "step_update",
    chipLabel: "조금만 더",
    message: L(
      "조금만 더 기다려 주세요",
      "もう少しお待ちください",
      "Just a little longer, please",
    ),
    group: "progress",
  },
  /* — 마무리 인사 — */
  {
    replyId: "closing_done",
    intent: "closing",
    chipLabel: "다 됐어요",
    message: L(
      "다 끝났어요! 마음에 드셨으면 좋겠어요",
      "完成しました！気に入っていただけたら嬉しいです",
      "All done! I hope you love it",
    ),
    primary: true,
    group: "closing",
  },
  {
    replyId: "closing_revisit",
    intent: "closing",
    chipLabel: "또 오세요",
    message: L(
      "오늘 와주셔서 감사합니다. 또 들러주세요!",
      "本日はご来店ありがとうございました。またお越しください！",
      "Thank you for coming in today. Please visit us again!",
    ),
    group: "closing",
  },
];

/* ── 소요시간 프리셋 (P0/P1, time 칩 자유 타이핑 제거) ──── */
export interface TimePreset {
  minutes: number;
  label: LocalizedText;
}

/**
 * time 퀵리플라이가 쓰는 분 단위 프리셋.
 * 디자이너는 칩을 탭만 하면 되고(타이핑0), 손님에게는 label[locale] 로 노출된다.
 */
export const TIME_PRESETS: TimePreset[] = [
  { minutes: 15, label: L("15분", "15分", "15 min") },
  { minutes: 30, label: L("30분", "30分", "30 min") },
  { minutes: 45, label: L("45분", "45分", "45 min") },
  { minutes: 60, label: L("1시간", "1時間", "1 hour") },
  { minutes: 90, label: L("1시간 30분", "1時間30分", "1.5 hours") },
  { minutes: 120, label: L("2시간", "2時間", "2 hours") },
];

/* ── 약제·제품 카탈로그 (P1, '30초 기록' 칩화) ─────────── */
/**
 * 디자이너가 시술 기록 시 탭으로 고르는 흔한 약제/제품.
 * HairReport.products(string[]) 에 들어갈 라벨의 소스.
 */
export const PRODUCTS: CatalogItem[] = [
  {
    id: "color_dye",
    label: L("컬러제(염모제)", "カラー剤", "Color dye"),
  },
  { id: "bleach", label: L("블리치(탈색제)", "ブリーチ剤", "Bleach") },
  {
    id: "perm_lotion_1",
    label: L("펌 1제", "パーマ1剤", "Perm lotion (1st)"),
  },
  {
    id: "perm_lotion_2",
    label: L("펌 2제", "パーマ2剤", "Perm lotion (2nd)"),
  },
  {
    id: "neutralizer",
    label: L("중화제", "中和剤", "Neutralizer"),
  },
  {
    id: "treatment",
    label: L("트리트먼트", "トリートメント", "Treatment"),
  },
  {
    id: "scalp_tonic",
    label: L("두피 토닉", "頭皮トニック", "Scalp tonic"),
  },
  {
    id: "straightener",
    label: L("매직약(연화제)", "縮毛矯正剤", "Straightening agent"),
  },
  {
    id: "protein",
    label: L("단백질 보충제(PPT)", "プロテイン剤", "Protein (PPT)"),
  },
  {
    id: "scalp_protector",
    label: L("두피 보호제", "頭皮保護剤", "Scalp protector"),
  },
];
