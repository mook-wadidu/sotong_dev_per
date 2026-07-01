import type { HairReport, Locale, ThreeLevel } from "@/lib/domain/types";
import type { ReportLabels } from "@/components/customer/report-view";
import type { ConsultationSummaryLabels } from "@/components/shared/consultation-summary";

/**
 * MVP 데모 스크립트(완전 하드코딩, 백엔드 0).
 * 같은 상담을 손님 트랙(영어, "Emma" · 미국) → 디자이너 트랙(한국어)으로 보여준다.
 * 사진은 public/demo/*.jpg 번들(무료·상업가능 Unsplash). 마음에 안 들면 그 파일만 교체.
 */

/* 참고/비포/애프터 사진 — public/demo (CSP img-src 'self' 호환, plain <img>). */
export const DEMO_PHOTOS = ["/demo/ref1.jpg", "/demo/ref2.jpg", "/demo/ref3.jpg"];
const BEFORE = "/demo/before.jpg";
const AFTER = "/demo/after.jpg";

/** 언어 선택 — 4개 손님 언어(영어 강조). */
export const DEMO_LANGS: {
  locale: Locale;
  native: string;
  sub: string;
  highlight?: boolean;
}[] = [
  { locale: "en", native: "English", sub: "영어", highlight: true },
  { locale: "ja", native: "日本語", sub: "일본어" },
  { locale: "zh", native: "中文", sub: "중국어" },
  { locale: "ko", native: "한국어", sub: "한국어" },
];

/**
 * 인트로(원장용, 한국어) — 콜드 DM 첫인상. 뷰어=한국 미용실 원장이므로
 * 안내는 한국어. 핵심 장면(손님 영어 → 원장 한국어)을 맨 위에서 먼저 보여준다.
 */
export const DEMO_INTRO = {
  title: "외국인 손님 상담, 이제 파파고 없이 상담하세요!",
  subtitle: "손님은 자기 언어로 탭하고, 디자이너께 한국어로 정리돼 옵니다.",
  // 핵심 장면 미니 프리뷰 — "한 메시지"가 번역됨: 원문(영어) → 번역(한국어)을 한 말풍선에 스택.
  previewGuest: "How long will it take?",
  previewOwner: "얼마나 걸려요?",
  previewTag: "자동 번역",
  values: [
    "손님이 원하는 스타일·모발 상태를 미리 입력 → 상담 시간 단축",
    "번역 앱 왔다갔다 없이, 한국어로 깔끔하게 정리",
    "설치·앱 없음. QR만 있으면 시작",
  ],
  duration: "30초면 양쪽 다 보여드릴게요 — 손님 화면 먼저, 그다음 디자이너 화면.",
  cta: "시작하기",
};

/** 압축 인테이크 — 양 언어 값(손님=EN, 디자이너=KO). */
export const DEMO_INTAKE = {
  servicesEn: ["Haircut", "Color"],
  servicesKo: ["컷", "염색"],
  styleNoteEn: "Long layered cut with soft waves",
  styleNoteKo: "롱 레이어드 컷 + 소프트 웨이브",
  memoEn: "Wants natural volume and an easy-to-manage style.",
  memoKo: "자연스러운 볼륨과 손질이 쉬운 스타일 원함.",
  genderEn: "Female",
  genderKo: "여성",
  age: 29,
  photos: DEMO_PHOTOS,
};

/* ── 인테이크 자동채움 스텝(데모 전용, EN) — 실제 폼 UI(Chip/PictoChip/얼굴형) 재사용 ── */
export const DEMO_INTAKE_TITLES = [
  "What would you like done?",
  "Photos of the style you want",
  "Pick your face shape",
  "Anything we should mind?",
  "A little about you",
  "Before we send it",
];

export const DEMO_INTAKE_SERVICES = [
  { id: "cut", label: "Women's Cut", price: "from ₩35,000" },
  { id: "color", label: "Full Color", price: "from ₩90,000" },
  { id: "perm", label: "Perm", price: "from ₩80,000" },
  { id: "clinic", label: "Treatment", price: "from ₩50,000" },
];
export const DEMO_INTAKE_SERVICES_SELECTED = ["cut", "color"];

export const DEMO_FACE_SHAPES = [
  { id: "oval", label: "Oval" },
  { id: "round", label: "Round" },
  { id: "square", label: "Square" },
  { id: "long", label: "Long" },
  { id: "heart", label: "Heart" },
  { id: "diamond", label: "Diamond" },
] as const;
export const DEMO_FACE_SELECTED = "oval";

export const DEMO_INTAKE_CONCERNS = [
  { id: "volume", label: "Lacks volume" },
  { id: "manage", label: "Hard to manage" },
  { id: "frizz", label: "Frizz / flyaways" },
  { id: "damage", label: "Damaged ends" },
  { id: "thin", label: "Thinning" },
  { id: "gray", label: "Gray hair" },
];
export const DEMO_CONCERNS_SELECTED = ["volume", "manage"];

export const DEMO_GENDERS = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "other", label: "Other" },
];
export const DEMO_AGE_BANDS = ["10s", "20s", "30s", "40s", "50s", "60s+"];
export const DEMO_ABOUT_SELECTED = { gender: "female", age: "20s" };

export const DEMO_CONSENT =
  "I agree to the collection of the information and photos I entered, for my style consultation.";
export const DEMO_CONSENT_HINT =
  "Used only for consultation & records, then deleted after about 90 days.";

/** 디자이너 인박스에 뜨는 한 건(흉내). */
export const DEMO_INBOX = {
  name: "Emma",
  language: "English",
  nationalityKo: "영어권",
  headlineKo: "여성 컷 · 염색",
  time: "오후 12:30",
};

/** 디자이너 요약(KO)용 — AI 요약/주의/예상가. */
export const DEMO_SUMMARY_KO = {
  headline: "여성 컷 · 염색",
  cautions: "모발 끝이 약간 건조 — 염색 직후 고열은 피하는 게 좋아요.",
  allergy: "없음",
  estimatedPrice: "약 12만원",
  aiSummary:
    "영어권 손님(영어). 롱 레이어드 컷 + 소프트 웨이브에 애쉬 브라운 풀 컬러를 원합니다. 자연스러운 볼륨과 손질이 쉬운 스타일 선호. 모발 끝이 다소 건조해 염색 직후 고열은 피하는 게 좋아요.",
};

/** 디자이너 시술 기록(흉내). */
export const DEMO_RECORD_KO = {
  products: ["모로칸오일 트리트먼트", "볼륨 미스트", "열보호제"],
  stateGrade: "좋음",
  satisfaction: 5,
  after: AFTER,
};

/** 채팅 — 각 엔트리 en+ko 둘 다(손님 트랙=EN 기준, 디자이너 트랙=KO 기준). */
export type ChatEntry =
  | { kind: "system"; en: string; ko: string }
  | { kind: "customer"; en: string; ko: string }
  | { kind: "designer"; en: string; ko: string };

export const DEMO_CHAT: ChatEntry[] = [
  {
    kind: "system",
    en: "Your consultation has started.",
    ko: "상담이 시작되었어요.",
  },
  {
    kind: "customer",
    en: "Hi! How long will the cut and color take?",
    ko: "안녕하세요! 컷이랑 염색 하면 얼마나 걸려요?",
  },
  {
    kind: "designer",
    en: "It'll take about 2 hours. Shall we start with a quick consultation?",
    ko: "2시간 정도 걸려요. 간단히 상담부터 시작할까요?",
  },
  {
    kind: "customer",
    en: "Sounds good. Roughly how much will it be?",
    ko: "좋아요. 대략 얼마 정도 들까요?",
  },
  {
    kind: "designer",
    en: "Cut and color together comes to about ₩120,000.",
    ko: "컷이랑 염색 같이 하면 12만원 정도예요.",
  },
  { kind: "customer", en: "Perfect — let's do it!", ko: "좋네요, 그걸로 할게요!" },
  {
    kind: "designer",
    en: "Great! I'll get everything ready and start now. ✨",
    ko: "좋아요! 준비해서 바로 시작할게요. ✨",
  },
];

/** 시술중 안내(양 언어). */
export const DEMO_INSERVICE_EN = {
  title: "Your service is underway",
  subtitle: "Sit back and relax — let us know if you have any questions.",
};
export const DEMO_INSERVICE_KO = {
  title: "시술 중입니다",
  subtitle: "편하게 계세요 — 궁금한 점 있으면 알려주세요.",
};

/** 손님 수신 직후 안내 + 트랙 전환 카드. */
export const DEMO_RECEIVED_NOTE =
  "Your designer received this and replies in their own language — you see it translated.";
export const DEMO_HANDOFF = {
  title: "여기서부턴 원장님 화면이에요",
  subtitle:
    "방금 그 상담이, 원장님껜 한국어로 도착해요. 손님이 쓴 영어는 자동 번역돼요.",
  cta: "원장님 화면 보기 ›",
};

/**
 * 비트별 나레이터 — 원장에게 말 거는 한국어(토스 톤). 각 비트는 큰 그레이 화면으로
 * 먼저 뜨고("이어서 보기"), 그 stage 콘텐츠가 자동 재생된다. 데모 뷰어=원장이라 항상 한국어.
 * 키 있는 stage = 그레이 나래이션 게이트가 붙는 stage. intro/intake/d-report는 게이트 없음.
 */
export const DEMO_NARRATION: Partial<
  Record<string, { headline: string; detail?: string }>
> = {
  // 비트1 — 손님 화면(입력)
  lang: {
    headline: "손님은 자기 폰으로 상담지를 입력해요",
    detail:
      "앱 설치·가입 없이, 텍스트나 사진으로 — 원하는 스타일·얼굴형·추구미 메뉴까지 골라서요.",
  },
  // 비트2 — 디자이너가 한국어로 받음
  "d-inbox": {
    headline: "디자이너는 한국어로 받아요",
    detail: "손님이 완성한 상담지가 그대로 한국어로 정리돼 도착해요.",
  },
  // 비트3 — 양방향 실시간 번역 상담
  "d-chat": {
    headline: "외국어로 물어봐도 괜찮아요",
    detail:
      "손님 말은 한국어로, 디자이너 답변은 손님 언어로 — 실시간 번역되며 상담이 이어져요.",
  },
  // 비트4 — 시술지 완성·공유
  "d-record": {
    headline: "시술 내용을 시술지로 정리해요",
    detail: "손님과 공유하고, 그대로 시술을 진행해요.",
  },
  // 비트5 — 리포트 + 별점 + 자산
  "d-report": {
    headline: "리포트로 남고, 샵의 자산이 돼요",
    detail:
      "전·후 사진 리포트를 손님과 공유하고 별점을 받아요. 쌓인 기록은 샵 자산으로 남아요.",
  },
};

/* ── 상담 요약 카드 라벨 ─────────────────────────────────── */
export const DEMO_SUMMARY_LABELS: ConsultationSummaryLabels = {
  title: "Consultation details",
  language: "Language",
  purpose: "Visit purpose",
  style: "Style you want",
  photos: "Reference photos",
  memo: "Notes",
  gender: "Gender",
  age: "Age",
  ageValue: "{age}",
  step: {
    label: "Progress",
    booked: "Inquiry",
    consulting: "Consulting",
    done: "Visited",
  },
};
export const DEMO_SUMMARY_LABELS_KO: ConsultationSummaryLabels = {
  title: "상담 정보",
  language: "언어",
  purpose: "방문 목적",
  style: "원하는 스타일",
  photos: "참고 이미지",
  memo: "추가 메모",
  gender: "성별",
  age: "나이",
  ageValue: "{age}세",
  step: {
    label: "진행 상황",
    booked: "예약문의",
    consulting: "상담진행",
    done: "방문완료",
  },
};

/* ── 리포트 ──────────────────────────────────────────────── */
const GRADE: ThreeLevel = "high";

export const DEMO_REPORT: HairReport = {
  serviceSummary:
    "Long layered cut to add movement, with a soft ash-brown full color and a moisture treatment for shine.",
  products: ["Moroccan oil treatment", "Volume mist", "Heat protectant"],
  hairStateGrade: GRADE,
  hairStateScore: 86,
  homeCare: [
    "Use a sulfate-free shampoo to keep the color longer.",
    "Apply a little treatment oil to the ends when damp.",
    "Air-dry when you can; use heat protectant before styling.",
  ],
  nextVisitWeeks: 8,
  styleRequest: "Long layered cut with soft waves",
  concerns: "Wants natural volume and an easy-to-manage style.",
  cautions: "Slightly dry ends — avoid high heat right after coloring.",
  consultationId: "demo",
  reportToken: "demo",
  salonName: "소통 헤어 신사점",
  designerName: "김민지",
  date: "2026-06-25",
  beforePhotoUrl: BEFORE,
  afterPhotoUrl: AFTER,
  locale: "en",
};

export const DEMO_REPORT_KO: HairReport = {
  serviceSummary:
    "롱 레이어드 컷으로 움직임을 주고, 부드러운 애쉬 브라운 풀 컬러 + 윤기를 위한 수분 트리트먼트를 진행했어요.",
  products: ["모로칸오일 트리트먼트", "볼륨 미스트", "열보호제"],
  hairStateGrade: GRADE,
  hairStateScore: 86,
  homeCare: [
    "색이 오래가도록 황산염 프리 샴푸를 사용하세요.",
    "머리가 젖었을 때 모발 끝에 트리트먼트 오일을 소량 바르세요.",
    "가능하면 자연 건조하고, 스타일링 전엔 열보호제를 쓰세요.",
  ],
  nextVisitWeeks: 8,
  styleRequest: "롱 레이어드 컷 + 소프트 웨이브",
  concerns: "자연스러운 볼륨과 손질이 쉬운 스타일 원함.",
  cautions: "모발 끝이 약간 건조 — 염색 직후 고열은 피하세요.",
  consultationId: "demo",
  reportToken: "demo-ko",
  salonName: "소통 헤어 신사점",
  designerName: "김민지",
  date: "2026-06-25",
  beforePhotoUrl: BEFORE,
  afterPhotoUrl: AFTER,
  locale: "ko",
};

export const DEMO_REPORT_LABELS: ReportLabels = {
  title: "Hair in-body report",
  subtitle: "Today's service record",
  salon: "Salon",
  designer: "Designer",
  date: "Service date",
  service: "Service",
  products: "Products used",
  hairState: "Hair condition",
  homeCare: "Home-care guide",
  before: "Before",
  after: "After",
  styleRequest: "Style you requested",
  concerns: "Concerns",
  cautions: "Care notes",
  dna: {
    title: "Hair & Face DNA",
    volume: "Volume",
    density: "Density",
    wave: "Wave",
    faceShape: "Face shape",
  },
  satisfaction: {
    title: "How was your service today?",
    thanks: "Thanks for your feedback!",
    error: "Couldn't save. Please try again.",
    readOnly: "Rated by the guest",
  },
  back: "Back",
  save: "Save as image",
  saveToast: "Report saved.",
  saveError: "Couldn't save the image. Please try again.",
  share: "Share",
  shareToast: "Share link copied.",
  scoreLabel: "86 pts",
  grade: "High",
  nationality: "Nationality",
  gender: "Gender",
  age: "Age",
  visitHistory: "Visit history",
};
export const DEMO_REPORT_LABELS_KO: ReportLabels = {
  title: "헤어 인바디 리포트",
  subtitle: "오늘 시술 기록이에요",
  salon: "살롱",
  designer: "담당 디자이너",
  date: "시술일",
  service: "받은 시술",
  products: "사용한 제품",
  hairState: "모발 상태",
  homeCare: "홈케어 가이드",
  before: "시술 전",
  after: "시술 후",
  styleRequest: "요청하신 스타일",
  concerns: "상담 시 고민",
  cautions: "시술 주의사항",
  dna: {
    title: "헤어 & 얼굴형 DNA",
    volume: "볼륨",
    density: "숱",
    wave: "웨이브",
    faceShape: "얼굴형",
  },
  satisfaction: {
    title: "오늘 시술은 만족스러우셨나요?",
    thanks: "소중한 평가 감사합니다!",
    error: "저장에 실패했어요. 다시 시도해 주세요.",
    readOnly: "손님이 직접 평가하는 항목이에요",
  },
  back: "뒤로",
  save: "이미지로 저장",
  saveToast: "리포트를 저장했어요",
  saveError: "이미지를 저장하지 못했어요. 다시 시도해주세요.",
  share: "공유하기",
  shareToast: "공유 링크를 복사했어요",
  scoreLabel: "86점",
  grade: "좋음",
  nationality: "국적",
  gender: "성별",
  age: "나이",
  visitHistory: "방문 이력",
};

// 데모 헤어/얼굴형 DNA — 삼각형이 또렷하게 보이도록 섞인 값.
export const DEMO_REPORT_HAIR = {
  faceShape: "oval",
  crownVolume: "mid",
  hairDensity: "high",
  hairType: "wavy",
} as const;

export const DEMO_REPORT_DATE_LABEL = "Jun 25, 2026";
export const DEMO_REPORT_DATE_LABEL_KO = "2026. 6. 25.";

export const DEMO_REPORT_PROFILE = {
  nationality: "English-speaking",
  gender: "Female",
  ageText: "29",
};
export const DEMO_REPORT_PROFILE_KO = {
  nationality: "영어권",
  gender: "여성",
  ageText: "29세",
};
export const DEMO_REPORT_VISIT = {
  totalText: "4 visits",
  lastText: "Last visit Jun 3, 2026",
};
export const DEMO_REPORT_VISIT_KO = {
  totalText: "총 4회",
  lastText: "최근 방문 2026. 6. 3.",
};
