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

/**
 * 라벨 헬퍼 — zh 는 4번째 손님 언어로 optional. 3인자 호출은 그대로 유효(zh 미포함),
 * 4번째 인자를 주면 zh 라벨이 포함된다. 실제 zh 라벨 채움은 Phase 3.
 */
const L = (ko: string, ja: string, en: string, zh?: string): LocalizedText =>
  zh === undefined ? { ko, ja, en } : { ko, ja, en, zh };

/* ── 시술 카탈로그 (§9.1) ───────────────────────────────── */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "cut",
    label: L("컷", "カット", "Cut", "剪发"),
    services: [
      {
        id: "cut_women",
        categoryId: "cut",
        label: L("여성 컷", "レディースカット", "Women's Cut", "女士剪发"),
        priceFrom: 35000,
      },
      {
        id: "cut_men",
        categoryId: "cut",
        label: L("남성 컷", "メンズカット", "Men's Cut", "男士剪发"),
        priceFrom: 28000,
      },
    ],
  },
  {
    id: "perm",
    label: L("펌", "パーマ", "Perm", "烫发"),
    services: [
      {
        id: "perm_general",
        categoryId: "perm",
        label: L("일반 펌", "パーマ", "Perm", "普通烫发"),
        priceFrom: 80000,
      },
      {
        id: "perm_digital",
        categoryId: "perm",
        label: L("디지털 펌", "デジタルパーマ", "Digital Perm", "数码烫"),
        priceFrom: 120000,
      },
    ],
  },
  {
    id: "color",
    label: L("염색", "カラー", "Color", "染发"),
    services: [
      {
        id: "color_full",
        categoryId: "color",
        label: L("전체 염색", "フルカラー", "Full Color", "全染"),
        priceFrom: 90000,
      },
      {
        id: "color_root",
        categoryId: "color",
        label: L("뿌리 염색", "リタッチ", "Root Touch-up", "补染发根"),
        priceFrom: 60000,
      },
      {
        id: "color_point",
        categoryId: "color",
        label: L("포인트 염색", "ポイントカラー", "Point Color", "挑染"),
        priceFrom: 70000,
      },
      {
        id: "color_bleach",
        categoryId: "color",
        label: L("탈색", "ブリーチ", "Bleach", "漂发"),
        priceFrom: 100000,
      },
    ],
  },
  {
    id: "clinic",
    label: L("클리닉", "トリートメント", "Clinic", "护理"),
    services: [
      {
        id: "clinic_treatment",
        categoryId: "clinic",
        label: L("트리트먼트", "トリートメント", "Treatment", "深层护理"),
        priceFrom: 50000,
      },
    ],
  },
  {
    id: "styling",
    label: L("스타일링", "スタイリング", "Styling", "造型"),
    services: [
      {
        id: "styling_dry",
        categoryId: "styling",
        label: L("드라이/스타일링", "ブロー/セット", "Blow-dry / Styling", "吹干造型"),
        priceFrom: 30000,
      },
      {
        id: "styling_magic",
        categoryId: "styling",
        label: L("매직/볼륨매직", "ストレートパーマ", "Straightening", "离子烫"),
        priceFrom: 90000,
      },
    ],
  },
];

/**
 * 손님 인테이크용 **고정 큰 분류**(MVP) — 손님은 세부 시술 대신 방향만 고른다.
 * 실제 세부 시술·가격은 디자이너가 기록폼에서 확정(serviceIds). styling 은 흡수하지 않고
 * 독립 분류로 둔다(학습 데이터 뭉개짐 방지). "etc"(기타)는 최소 catch-all.
 */
export const INTAKE_CATEGORIES = [
  { id: "cut", label: L("컷", "カット", "Cut", "剪发") },
  { id: "perm", label: L("펌", "パーマ", "Perm", "烫发") },
  { id: "color", label: L("염색", "カラー", "Color", "染发") },
  { id: "clinic", label: L("클리닉·케어", "クリニック・ケア", "Clinic & Care", "护理") },
  { id: "styling", label: L("스타일링", "スタイリング", "Styling", "造型") },
  { id: "etc", label: L("기타", "その他", "Other", "其他") },
];

export const ALL_SERVICES: ServiceItem[] = SERVICE_CATEGORIES.flatMap(
  (c) => c.services,
);

/* ── 얼굴형 (§9.2, 픽토그램 6종) ───────────────────────── */
export interface FaceShapeItem extends CatalogItem {
  id: FaceShape;
}
export const FACE_SHAPES: FaceShapeItem[] = [
  { id: "oval", label: L("계란형", "卵型", "Oval", "鹅蛋脸") },
  { id: "round", label: L("둥근형", "丸顔", "Round", "圆脸") },
  { id: "square", label: L("각진형", "ベース型", "Square", "方脸") },
  { id: "long", label: L("긴형", "面長", "Long", "长脸") },
  { id: "heart", label: L("하트형", "ハート型", "Heart", "心形脸") },
  { id: "diamond", label: L("다이아몬드형", "ひし形", "Diamond", "菱形脸") },
];

/* ── 두상/머리숱/모질 (§9.3) ───────────────────────────── */
export const CROWN_VOLUME: CatalogItem[] = [
  { id: "high", label: L("볼륨 있음", "ボリュームあり", "High volume", "蓬松") },
  { id: "mid", label: L("보통", "普通", "Normal", "一般") },
  { id: "low", label: L("볼륨 없음", "ボリュームなし", "Flat", "扁塌") },
];
export const HAIR_DENSITY: CatalogItem[] = [
  { id: "high", label: L("많음", "多い", "Thick", "浓密") },
  { id: "mid", label: L("보통", "普通", "Normal", "一般") },
  { id: "low", label: L("적음", "少ない", "Thin", "稀疏") },
];
export const HAIR_TYPE: CatalogItem[] = [
  { id: "straight", label: L("직모", "直毛", "Straight", "直发") },
  { id: "wavy", label: L("반곱슬", "くせ毛", "Wavy", "微卷") },
  { id: "curly", label: L("곱슬", "強いくせ毛", "Curly", "卷发") },
];

/* ── 모발 이력 (§9.4, 다중선택) ────────────────────────── */
export const HAIR_HISTORY: CatalogItem[] = [
  {
    id: "bleach_recent",
    label: L("6개월 내 탈색", "6ヶ月以内のブリーチ", "Bleached within 6 months", "6个月内漂过"),
  },
  {
    id: "bleach_old",
    label: L("이전 탈색 이력", "以前のブリーチ", "Bleached before", "以前漂过"),
  },
  { id: "perm_history", label: L("펌 이력", "パーマ履歴", "Perm history", "烫过发") },
  {
    id: "color_history",
    label: L("염색 이력", "カラー履歴", "Color history", "染过发"),
  },
  {
    id: "straighten_history",
    label: L("매직/스트레이트닝", "縮毛矯正", "Straightening", "做过离子烫"),
  },
];

/* ── 평소 고민 (§9.5, 다중선택·건너뛰기 가능) ──────────── */
export const CONCERNS: CatalogItem[] = [
  { id: "no_volume", label: L("볼륨이 없어요", "ボリュームが出ない", "No volume", "不蓬松") },
  { id: "frizzy", label: L("곱슬이 심해요", "くせが強い", "Very frizzy", "毛躁") },
  { id: "wide_forehead", label: L("이마가 넓어요", "おでこが広い", "Wide forehead", "额头较宽") },
  { id: "sensitive_scalp", label: L("두피가 예민해요", "頭皮が敏感", "Sensitive scalp", "头皮敏感") },
  { id: "thin_hair", label: L("머리숱이 적어요", "髪が少ない", "Thin hair", "发量少") },
  { id: "damaged", label: L("손상이 심해요", "ダメージが強い", "Very damaged", "受损严重") },
  { id: "gray_hair", label: L("흰머리를 가리고 싶어요", "白髪を隠したい", "Cover gray hair", "想遮盖白发") },
  { id: "big_face", label: L("얼굴이 커 보여요", "顔が大きく見える", "Face looks big", "脸显大") },
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
      "欢迎光临！我马上为您服务",
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
      "我带您到这边的座位",
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
      "请稍等，我马上过去",
    ),
    group: "greeting",
  },
  /* — 가능 / 조건부 / 불가 — */
  {
    replyId: "available",
    intent: "available",
    chipLabel: "가능해요",
    message: L("네, 가능합니다", "はい、可能です", "Yes, we can do that", "可以的，没问题"),
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
      "可以做，但效果会因发质状况而有所不同",
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
      "很抱歉，今天可能无法做这个项目",
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
      "我确认一下马上告诉您",
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
      "这样做您觉得怎么样？",
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
      "我推荐您试试这款发型",
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
      "能再给我看几张您想要的发型照片吗？",
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
      "预计价格为 {value}",
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
      "大约需要 {value}",
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
      "正在为您做造型",
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
      "现在是收尾阶段，快好了",
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
      "请再稍等一会儿",
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
      "全部完成啦！希望您喜欢",
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
      "感谢今天光临，欢迎下次再来！",
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
  { minutes: 15, label: L("15분", "15分", "15 min", "15分钟") },
  { minutes: 30, label: L("30분", "30分", "30 min", "30分钟") },
  { minutes: 45, label: L("45분", "45分", "45 min", "45分钟") },
  { minutes: 60, label: L("1시간", "1時間", "1 hour", "1小时") },
  { minutes: 90, label: L("1시간 30분", "1時間30分", "1.5 hours", "1小时30分钟") },
  { minutes: 120, label: L("2시간", "2時間", "2 hours", "2小时") },
];

/* ── 약제·제품 카탈로그 (P1, '30초 기록' 칩화) ─────────── */
/**
 * 디자이너가 시술 기록 시 탭으로 고르는 흔한 약제/제품.
 * HairReport.products(string[]) 에 들어갈 라벨의 소스.
 */
export const PRODUCTS: CatalogItem[] = [
  {
    id: "color_dye",
    label: L("컬러제(염모제)", "カラー剤", "Color dye", "染发剂"),
  },
  { id: "bleach", label: L("블리치(탈색제)", "ブリーチ剤", "Bleach", "漂发剂") },
  {
    id: "perm_lotion_1",
    label: L("펌 1제", "パーマ1剤", "Perm lotion (1st)", "烫发剂(一剂)"),
  },
  {
    id: "perm_lotion_2",
    label: L("펌 2제", "パーマ2剤", "Perm lotion (2nd)", "烫发剂(二剂)"),
  },
  {
    id: "neutralizer",
    label: L("중화제", "中和剤", "Neutralizer", "中和剂"),
  },
  {
    id: "treatment",
    label: L("트리트먼트", "トリートメント", "Treatment", "护理剂"),
  },
  {
    id: "scalp_tonic",
    label: L("두피 토닉", "頭皮トニック", "Scalp tonic", "头皮养护液"),
  },
  {
    id: "straightener",
    label: L("매직약(연화제)", "縮毛矯正剤", "Straightening agent", "软化剂"),
  },
  {
    id: "protein",
    label: L("단백질 보충제(PPT)", "プロテイン剤", "Protein (PPT)", "蛋白补充剂(PPT)"),
  },
  {
    id: "scalp_protector",
    label: L("두피 보호제", "頭皮保護剤", "Scalp protector", "头皮保护剂"),
  },
];
