/**
 * 사이트 전체 카피 + 데모 시뮬레이터 스크립트.
 * 추후 다국어 확장이나 실제 소스 연결 시 이 파일의 구조만 유지하면 됩니다.
 */

export const brand = {
  name: "소통",
  nameEn: "Sotong",
  tagline: "외국인 손님 상담, 이제 파파고 없이.",
};

export const nav = {
  links: [
    { label: "기능", href: "#features" },
    { label: "이용 방법", href: "#how" },
    { label: "데모", href: "#demo" },
  ],
  cta: { label: "데모 보기", href: "/demo/play" },
};

/* ─────────────────────────────  랜딩 인트로 시퀀스  ───────────────────────────── */

/** 헤드라인 세그먼트: highlight=true면 브랜드 컬러 강조 */
export type Segment = { text: string; highlight?: boolean };

export type IntroSlide =
  | {
      kind: "hook"; // 타자기 타이핑
      bg: "dark";
      segments: Segment[];
      durationMs: number;
    }
  | {
      kind: "empathy"; // 사진 + 헤드라인 + 상황 연출
      bg: "light";
      segments: Segment[];
      image: string;
      durationMs: number;
      /** "missed": 손님 질문 + 답 못하는 매장 / "translator": 번역앱 왕복 */
      scene: "missed" | "translator";
      /** missed 시 손님/매장 말풍선 */
      customerBubble?: string;
      staffBubble?: string;
      /** translator 시 번역 왕복 라인 */
      translations?: { src: string; dst: string; from: "guest" | "staff" }[];
      translatorCaption?: string;
    }
  | {
      kind: "brand"; // 소통 로고
      bg: "dark";
      durationMs: number;
    };

export const intro = {
  slides: [
    {
      kind: "hook",
      bg: "dark",
      segments: [
        { text: "외국인 손님 상담,\n이제 " },
        { text: "번역기", highlight: true },
        { text: " 없이." },
      ],
      durationMs: 3200,
    },
    {
      kind: "brand",
      bg: "dark",
      durationMs: 2600,
    },
  ] satisfies IntroSlide[],
};

export const hero = {
  
  title: ["외국인 손님 상담,", "이제 번역기 없이."],
  subtitle: [
    "외국인 손님이 들어왔는데\n말이 통하지 않아 당황한 경험 있으신가요?",
    "답답하고 복잡한 번역 앱 대신,\n더 자연스럽고 정돈된 응대 흐름을 만들어보세요.",
  ],
  primaryCta: { label: "데모 보기", href: "/demo/play" },
  secondaryCta: { label: "작동 방식 보기", href: "#how" },
  stats: [
    { value: "0개", label: "설치할 앱" },
    { value: "10+", label: "지원 언어" },
    { value: "30초", label: "상담 준비" },
  ],
};

export const benefits = {
  title: "번역기 붙잡고 진땀 빼던 상담, 이렇게 달라집니다",
  subtitle: "손님도 디자이너도 답답하지 않게.",
  items: [
    {
      icon: "clock",
      title: "상담 시간 단축",
      desc: "손님이 시술·헤어 상태를 미리 탭해두면, 자리에 앉기 전에 상담의 절반이 끝나 있습니다.",
    },
    {
      icon: "languages",
      title: "번역앱 왔다 갔다 끝",
      desc: "손님의 말이 자동으로 한국어로 정리돼 도착합니다. 번역기 창을 띄울 필요가 없어요.",
    },
    {
      icon: "qr",
      title: "설치 없이 QR만",
      desc: "손님은 앱을 깔지 않습니다.\n테이블 위 QR을 찍으면 바로 자기 언어 화면이 열립니다.",
    },
  ],
};

export const how = {
  title: "이용 방법은 5단계면 충분해요",
  steps: [
    {
      n: "01",
      title: "QR 스캔",
      desc: "손님이 테이블 위 QR을 찍으면 앱 설치·회원가입 없이 자기 언어 화면이 바로 열립니다.",
    },
    {
      n: "02",
      title: "사용자 언어로 상담지 작성",
      desc: "원하는 시술·스타일·헤어 상태를 손님이 자기 언어로 탭하며 상담지를 작성해요. 참고 사진도 함께 첨부할 수 있어요.",
    },
    {
      n: "03",
      title: "디자이너 폰에 한국어 상담지 도착",
      desc: "손님이 작성한 상담지가 한국어로 깔끔하게 번역·정리돼 담당 디자이너 휴대폰으로 바로 도착합니다.",
    },
    {
      n: "04",
      title: "각자 언어로 세부 상담",
      desc: "손님은 자기 언어로, 디자이너는 한국어로 주고받으면 실시간으로 번역돼요. 궁금한 점까지 정확히 맞춰 상담해요.",
    },
    {
      n: "05",
      title: "Hair 리포트 공유",
      desc: "시술 내용·사용 제품·홈케어 가이드를 담은 헤어 리포트를 손님 언어로 공유해요. 재방문 때 기록으로 이어집니다.",
    },
  ],
};

export const demoTeaser = {
  title: "30초면 양쪽 다 보여드릴게요",
  desc: "손님 화면에서 디자이너 화면까지, 실제로 어떻게 이어지는지 직접 확인해 보세요.",
  cta: { label: "인터랙티브 데모 열기", href: "#demo" },
};

/* ─────────────────────────────  데모 시뮬레이터  ───────────────────────────── */

export type CustomerLang = "en" | "zh" | "ja";

export const customerLangs: {
  code: CustomerLang;
  label: string;
  flag: string;
}[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

/** 손님이 탭하는 사전 선택 옵션 (언어별 라벨 + 한국어 정리값) */
export type DemoOption = {
  ko: string; // 디자이너에게 정리되는 한국어
  label: Record<CustomerLang, string>; // 손님 화면 라벨
};

export const demoOptions: Record<"service" | "detail", DemoOption> = {
  service: {
    ko: "컷 + 펌",
    label: { en: "Cut + Perm", zh: "剪发 + 烫发", ja: "カット + パーマ" },
  },
  detail: {
    ko: "옆·뒤는 짧게, 앞머리는 그대로",
    label: {
      en: "Short on sides & back, keep the bangs",
      zh: "两侧和后面剪短，刘海保留",
      ja: "サイドと後ろは短く、前髪はそのまま",
    },
  },
};

/** 손님이 자기 언어로 남기는 자유 질문 */
export const demoQuestion: Record<CustomerLang, string> = {
  en: "How long will it take?",
  zh: "大概需要多长时间？",
  ja: "どのくらい時間がかかりますか？",
};

/** 디자이너 화면에 정리되어 도착하는 한국어 요약 */
export const demoDesignerSummary = {
  guest: "외국인 손님",
  /** 손님이 고른 언어 → 디자이너 화면에 표시되는 국적 */
  nationalityByLang: { en: "영어권", zh: "중국", ja: "일본" } as Record<
    CustomerLang,
    string
  >,
  headline: "새 상담 요청이 도착했어요",
  requestLabel: "손님 요청",
  bullets: ["시술: 컷 + 펌", "디테일: 옆·뒤는 짧게, 앞머리는 그대로"],
  translatedQuestionLabel: "손님 질문 (번역)",
  translatedQuestion: "얼마나 걸려요?",
};

/* ── 양방향 번역 대화 (디자이너 답장) ── */

/** 디자이너 빠른 답장 칩 + 손님 언어 번역 (chips[0] === 실제 전송되는 답) */
export const demoReply = {
  label: "빠른 답장",
  chips: ["약 2시간이면 돼요", "가격은 8만 원이에요", "스타일 사진 있으세요?"],
  answerKo: "약 2시간이면 돼요",
  answer: {
    en: "It takes about 2 hours 😊",
    zh: "大约2小时就好 😊",
    ja: "だいたい2時間くらいで終わります 😊",
  } as Record<CustomerLang, string>,
  /** 손님 화면에서 답장 위에 붙는 라벨 */
  customerNote: {
    en: "From your designer",
    zh: "来自您的设计师",
    ja: "担当スタイリストより",
  } as Record<CustomerLang, string>,
};

/* ── 시술 후 헤어 리포트 (손님 언어로 발송) ── */

export const demoReportScore = 86;

export const demoReport: Record<
  CustomerLang,
  {
    title: string;
    salon: string;
    serviceLabel: string;
    service: string;
    productsLabel: string;
    products: string[];
    scoreLabel: string;
    grade: string;
    homeCareLabel: string;
    homeCare: string;
    nextVisitLabel: string;
    nextVisit: string;
    thanks: string;
  }
> = {
  en: {
    title: "Your Hair Report",
    salon: "Sotong Hair · Designer Minji",
    serviceLabel: "Today's service",
    service: "Cut + Perm",
    productsLabel: "Products used",
    products: ["Moisture perm solution", "Damage-care treatment"],
    scoreLabel: "Hair condition",
    grade: "Great",
    homeCareLabel: "Home care",
    homeCare: "Air-dry, then scrunch gently. Use the treatment twice a week.",
    nextVisitLabel: "Next visit",
    nextVisit: "in about 8 weeks",
    thanks: "Thanks for visiting — see you next time!",
  },
  zh: {
    title: "您的护发报告",
    salon: "Sotong Hair · 设计师 Minji",
    serviceLabel: "今日服务",
    service: "剪发 + 烫发",
    productsLabel: "使用产品",
    products: ["保湿烫发药水", "损伤护理护发素"],
    scoreLabel: "头发状态",
    grade: "良好",
    homeCareLabel: "居家护理",
    homeCare: "自然风干后轻轻抓卷，每周使用两次护发素。",
    nextVisitLabel: "下次到访",
    nextVisit: "约8周后",
    thanks: "感谢光临，期待再次见到您！",
  },
  ja: {
    title: "あなたのヘアレポート",
    salon: "Sotong Hair · スタイリスト Minji",
    serviceLabel: "本日の施術",
    service: "カット + パーマ",
    productsLabel: "使用した商品",
    products: ["保湿パーマ剤", "ダメージケアトリートメント"],
    scoreLabel: "髪の状態",
    grade: "良好",
    homeCareLabel: "ホームケア",
    homeCare: "自然乾燥のあと軽く握って整えてください。週2回トリートメントを。",
    nextVisitLabel: "次回のご来店",
    nextVisit: "約8週間後",
    thanks: "ご来店ありがとうございました。またお待ちしています！",
  },
};

/* ── 데모 액트(챕터): 사장이 큰 흐름을 이해하도록 4단계로 묶음 ── */

export type DemoAct = {
  id: string;
  /** 챕터 제목 (사장 관점) */
  title: string;
  /** 이 챕터의 가치 한 줄 */
  valueNote: string;
};

export const demoActs: DemoAct[] = [
  {
    id: "request",
    title: "손님이 자기 언어로 요청",
    valueNote: "말이 통하지 않아도, 손님이 스스로 정리해 전달합니다.",
  },
  {
    id: "arrive",
    title: "디자이너 폰에 한국어로 도착",
    valueNote: "파파고를 켤 필요 없이, 요청이 한국어로 정리돼 옵니다.",
  },
  {
    id: "chat",
    title: "양방향 번역 대화",
    valueNote: "디자이너는 한국어로, 손님은 자기 언어로 실시간 대화합니다.",
  },
  {
    id: "report",
    title: "시술 후 헤어 리포트",
    valueNote: "손님은 자기 언어로 시술 기록을 받고, 다시 찾게 됩니다.",
  },
];

/* ── 단계 정의: 선형 스텝 (직접 탭 진행) ── */

/** 사용자가 직접 탭하는 대상 (없으면 시스템 스텝 → "계속" 버튼) */
export type DemoTapTarget = "lang" | "service" | "detail" | "send" | "reply";

export type DemoStep = {
  id: string;
  /** demoActs 인덱스 */
  act: number;
  /** 자막: 지금 무슨 일이 일어나는지 */
  caption: string;
  /** 이번 단계에 주목할 화면 */
  focus: "customer" | "designer";
  /** 직접 탭할 대상 (null이면 시스템 스텝) */
  tapTarget: DemoTapTarget | null;
  /** 시스템 스텝일 때 "계속" 버튼 라벨 */
  continueLabel?: string;
};

export const demoSteps = [
  {
    id: "lang",
    act: 0,
    focus: "customer",
    tapTarget: "lang",
    caption: "손님이 자기 언어를 고릅니다.",
  },
  {
    id: "service",
    act: 0,
    focus: "customer",
    tapTarget: "service",
    caption: "원하는 시술을 탭합니다.",
  },
  {
    id: "detail",
    act: 0,
    focus: "customer",
    tapTarget: "detail",
    caption: "디테일까지 미리 선택해 둡니다.",
  },
  {
    id: "question",
    act: 0,
    focus: "customer",
    tapTarget: "send",
    caption: "궁금한 점을 자기 언어로 남기고 전송합니다.",
  },
  {
    id: "summary",
    act: 1,
    focus: "designer",
    tapTarget: null,
    caption: "디자이너 폰에 한국어로 정리돼 도착합니다.",
    continueLabel: "요약 확인",
  },
  {
    id: "reply",
    act: 2,
    focus: "designer",
    tapTarget: "reply",
    caption: "디자이너가 한국어로 빠르게 답합니다.",
  },
  {
    id: "replied",
    act: 2,
    focus: "designer",
    tapTarget: null,
    caption: "답장이 손님 언어로 번역돼 도착합니다.",
    continueLabel: "다음",
  },
  {
    id: "report",
    act: 3,
    focus: "customer",
    tapTarget: null,
    caption: "시술이 끝나면 손님 언어로 헤어 리포트가 발송됩니다.",
    continueLabel: "리포트 보기",
  },
] as const satisfies readonly DemoStep[];

export type DemoStepId = (typeof demoSteps)[number]["id"];

/** 스텝 id → 전체 순서상의 인덱스 (화면 노출 로직에서 사용) */
export const DEMO_STEP_INDEX = Object.fromEntries(
  demoSteps.map((s, i) => [s.id, i])
) as Record<DemoStepId, number>;

export const demoPage = {
  eyebrow: "인터랙티브 데모",
  title: "손님 입장·디자이너 입장, 직접 눌러보세요",
  subtitle:
    "손님이 자기 언어로 탭하면 디자이너에게 한국어로 정리돼 도착하고, 양방향 번역 대화와 시술 후 헤어 리포트까지 이어집니다. 아래에서 한 단계씩 직접 눌러 확인해 보세요.",
  points: [
    "손님은 앱 설치 없이, 자기 언어로 요청",
    "디자이너는 파파고 없이, 한국어로 정리된 요청",
    "시술 후엔 손님 언어 리포트로 재방문까지",
  ],
  finalCta: {
    title: "우리 매장에도 도입해 볼까요?",
    desc: "QR 하나면 오늘부터 외국인 손님 상담이 편해집니다.",
    label: "우리 매장에 도입하기",
    href: "https://www.wadidu.com/contact",
  },
};

export const footer = {
  copyright: `© ${new Date().getFullYear()} 소통 · Sotong. All rights reserved.`,
  note: "미용실 외국인 손님을 위한 다국어 AI 상담·접수 데스크",
};
