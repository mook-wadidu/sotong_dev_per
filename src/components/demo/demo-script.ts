import type {
  HairReport,
  Locale,
  ThreeLevel,
} from "@/lib/domain/types";
import type { ReportLabels } from "@/components/customer/report-view";
import type { ConsultationSummaryLabels } from "@/components/shared/consultation-summary";

/**
 * MVP 데모용 하드코딩 스크립트.
 * 백엔드(DB·AI·토큰) 전혀 없이, 영어권 손님("Emma") 전체 여정을 결정적으로 재생한다.
 * 실데이터로 보여주기 전 "실제로 하면 이런 느낌이구나"를 마찰 없이 시연하는 용도.
 * 다국어 손님 스크립트는 후속 확장(지금은 EN 1종).
 */

/** 네트워크 0 — 인라인 회색 SVG 플레이스홀더(참고사진·비포·애프터). */
const graySvg = (hex: string): string =>
  `data:image/svg+xml;utf8,` +
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>` +
  `<rect width='240' height='240' fill='%23${hex}'/></svg>`;

export const DEMO_PHOTOS: string[] = [
  graySvg("e7e7ea"),
  graySvg("dededf"),
  graySvg("e2e2e5"),
];

/** 언어 선택 단계 — 4개 손님 언어(영어 강조). */
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

/** 압축 인테이크 — 시술 칩 + 스타일 노트(자동 타이핑) + 참고사진. */
export const DEMO_INTAKE = {
  services: ["Haircut", "Color"],
  styleNote: "Long layered cut with soft waves",
  photos: DEMO_PHOTOS,
};

/** 채팅 엔트리 — 손님 EN(자동 타이핑) ↔ 디자이너 KO 원문/EN 번역. 한 탭에 하나씩. */
export type ChatEntry =
  | { kind: "system"; text: string }
  | { kind: "customer"; text: string }
  | { kind: "designer"; text: string; original: string };

export const DEMO_CHAT: ChatEntry[] = [
  { kind: "system", text: "Your consultation has started." },
  { kind: "customer", text: "Hi! How long will the cut and color take?" },
  {
    kind: "designer",
    text: "It'll take about 2 hours. Shall we start with a quick consultation?",
    original: "2시간 정도 걸려요. 간단히 상담부터 시작할까요?",
  },
  { kind: "customer", text: "Sounds good. Roughly how much will it be?" },
  {
    kind: "designer",
    text: "Cut and color together comes to about ₩120,000.",
    original: "컷이랑 염색 같이 하면 12만원 정도예요.",
  },
  { kind: "customer", text: "Perfect — let's do it!" },
  {
    kind: "designer",
    text: "Great! I'll get everything ready and start now. ✨",
    original: "좋아요! 준비해서 바로 시작할게요. ✨",
  },
];

/** 시술중 화면 안내(손님 언어). */
export const DEMO_INSERVICE = {
  title: "Your service is underway",
  subtitle: "Sit back and relax — let us know if you have any questions.",
};

/** 상담 요약 카드(목업①) 라벨 — EN. 디자이너 수신·시술중 화면 공용. */
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

/** 손님 수신 직후 문구. */
export const DEMO_RECEIVED_NOTE =
  "Your designer received this and is replying in their own language — you'll see it translated.";

/** 리포트(목업②) — Emma, 미국. before/after·점수·방문이력 하드코딩. */
const REPORT_GRADE: ThreeLevel = "high";

export const DEMO_REPORT: HairReport = {
  serviceSummary:
    "Long layered cut to add movement, with a soft ash-brown full color and a moisture treatment for shine.",
  products: ["Moroccan oil treatment", "Volume mist", "Heat protectant"],
  hairStateGrade: REPORT_GRADE,
  hairStateScore: 86,
  homeCare: [
    "Use a sulfate-free shampoo to keep the color longer.",
    "Apply a small amount of treatment oil to the ends when damp.",
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
  beforePhotoUrl: graySvg("d8d8db"),
  afterPhotoUrl: graySvg("ededf0"),
  locale: "en",
};

export const DEMO_REPORT_DATE_LABEL = "Jun 25, 2026";
export const DEMO_REPORT_NEXT_VISIT = "In about 8 weeks";

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
  nextVisit: "Recommended next visit",
  before: "Before",
  after: "After",
  styleRequest: "Style you requested",
  concerns: "Concerns",
  cautions: "Care notes",
  book: "Book next visit",
  bookToast: "Booking request received. The salon will contact you soon.",
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

export const DEMO_REPORT_PROFILE = {
  nationality: "United States",
  gender: "Female",
  ageText: "29",
};

export const DEMO_REPORT_VISIT = {
  totalText: "4 visits",
  lastText: "Last visit Jun 3, 2026",
};
