import { randomBytes, randomUUID } from "node:crypto";
import type {
  Consultation,
  ConsultationStatus,
  DesignerSummary,
  HairReport,
  Message,
} from "@/lib/domain/types";
import type {
  CreateConsultationInput,
  CreateDesignerInput,
  CreateSalonInput,
  Designer,
  DesignerRank,
  ErrorLog,
  ListConsultationsOptions,
  NewErrorLog,
  NewMessage,
  NewPushSub,
  PushSub,
  Repo,
  Salon,
  SalonService,
  SalonServiceCategory,
} from "./types";

/**
 * 인메모리 Repo — 제로 셋업 기본 드라이버. `pnpm dev` 만으로 핵심 루프가 돈다.
 * dev HMR 사이에 상태가 날아가지 않도록 globalThis 에 캐시한다.
 * (단일 프로세스 한정이라 손님 폰/디자이너 폰이 같은 dev 서버를 보면 스레드가 공유됨)
 */
interface Store {
  salons: Map<string, Salon>;
  designers: Map<string, Designer>; // designerId -> Designer
  serviceCategories: Map<string, SalonServiceCategory>; // categoryId -> cat
  services: Map<string, SalonService>; // serviceId -> service
  consultations: Map<string, Consultation>;
  byConsultationToken: Map<string, string>;
  byDesignerToken: Map<string, string>;
  byReportToken: Map<string, string>;
  messages: Map<string, Message[]>; // consultationId -> messages
  reports: Map<string, HairReport>; // reportToken -> report
  pushSubs: Map<string, PushSub>; // endpoint -> subscription
  errors: ErrorLog[];
}

// 직급(rank) — 양 살롱 동일(데모). director/senior/designer.
const DEMO_RANKS: DesignerRank[] = [
  { id: "director", label: "원장" },
  { id: "senior", label: "실장" },
  { id: "designer", label: "디자이너" },
];

// 살롱은 그룹 메타 + 직급 + 오너 콘솔 토큰. 고정값(데모 결정적).
const DEMO_SALONS: Salon[] = [
  {
    slug: "salon-demo",
    name: "소통 헤어 신사점",
    locales: ["ja", "en", "ko"],
    address: "서울 강남구 신사동 가로수길 12",
    tel: "02-1234-5678",
    businessHours: "10:00–20:00 (월 휴무)",
    placementLabel: "입구 데스크 / 거울 앞",
    entryKeyVersion: 1,
    designerRanks: DEMO_RANKS,
    ownerToken: "owner_sinsa_a1b2c3d4e5f6",
  },
  {
    slug: "salon-hongdae",
    name: "소통 헤어 홍대점",
    locales: ["ja", "en", "ko"],
    address: "서울 마포구 양화로 23길 8",
    tel: "02-2345-6789",
    businessHours: "11:00–21:00 (화 휴무)",
    placementLabel: "대기 소파 옆 / 입구 유리문",
    entryKeyVersion: 1,
    designerRanks: DEMO_RANKS,
    ownerToken: "owner_hongdae_f6e5d4c3b2a1",
  },
];

// 살롱별 디자이너 — 고정 id·staffToken·rankId(데모 안정). 운영 시드는 token() 으로 회전.
const DEMO_DESIGNERS: Designer[] = [
  {
    id: "d_sinsa_minji",
    salonSlug: "salon-demo",
    name: "김민지",
    staffToken: "staff_minji_2b9f5c1a4e7d",
    entryKeyVersion: 1,
    rankId: "director",
  },
  {
    id: "d_sinsa_jisoo",
    salonSlug: "salon-demo",
    name: "박지수",
    staffToken: "staff_jisoo_8a31c7e4f0d2",
    entryKeyVersion: 1,
    rankId: "designer",
  },
  {
    id: "d_hongdae_seojun",
    salonSlug: "salon-hongdae",
    name: "이서준",
    staffToken: "staff_seojun_7c4e1f9a2d6b",
    entryKeyVersion: 1,
    rankId: "senior",
  },
  {
    id: "d_hongdae_hana",
    salonSlug: "salon-hongdae",
    name: "최하나",
    staffToken: "staff_hana_5d0b3e8a1f64",
    entryKeyVersion: 1,
    rankId: "designer",
  },
];

const L = (ko: string, ja: string, en: string) => ({ ko, ja, en });

/**
 * 살롱별 메뉴 시드(양 살롱 동일). 기존 catalog/data.ts id·가격 재사용.
 * director(원장)에 한해 일부 시술 +20% rankPrices 예시(콘솔에서 직급별 가격 추가 시연용).
 */
interface SeedCat {
  id: string;
  label: ReturnType<typeof L>;
  sort: number;
}
interface SeedSvc {
  id: string;
  categoryId: string;
  label: ReturnType<typeof L>;
  basePriceFrom: number;
  rankPrices?: Record<string, number>;
}

const SEED_CATEGORIES: SeedCat[] = [
  { id: "cut", label: L("컷", "カット", "Cut"), sort: 1 },
  { id: "perm", label: L("펌", "パーマ", "Perm"), sort: 2 },
  { id: "color", label: L("염색", "カラー", "Color"), sort: 3 },
  { id: "clinic", label: L("클리닉", "トリートメント", "Clinic"), sort: 4 },
  { id: "styling", label: L("스타일링", "スタイリング", "Styling"), sort: 5 },
];

const SEED_SERVICES: SeedSvc[] = [
  // 컷 — 원장 직급가 +20% 예시
  {
    id: "cut_women",
    categoryId: "cut",
    label: L("여성 컷", "レディースカット", "Women's Cut"),
    basePriceFrom: 35000,
    rankPrices: { director: 42000 },
  },
  {
    id: "cut_men",
    categoryId: "cut",
    label: L("남성 컷", "メンズカット", "Men's Cut"),
    basePriceFrom: 28000,
    rankPrices: { director: 33600 },
  },
  {
    id: "perm_general",
    categoryId: "perm",
    label: L("일반 펌", "パーマ", "Perm"),
    basePriceFrom: 80000,
  },
  {
    id: "perm_digital",
    categoryId: "perm",
    label: L("디지털 펌", "デジタルパーマ", "Digital Perm"),
    basePriceFrom: 120000,
  },
  {
    id: "color_full",
    categoryId: "color",
    label: L("전체 염색", "フルカラー", "Full Color"),
    basePriceFrom: 90000,
  },
  {
    id: "color_root",
    categoryId: "color",
    label: L("뿌리 염색", "リタッチ", "Root Touch-up"),
    basePriceFrom: 60000,
  },
  {
    id: "color_point",
    categoryId: "color",
    label: L("포인트 염색", "ポイントカラー", "Point Color"),
    basePriceFrom: 70000,
  },
  {
    id: "color_bleach",
    categoryId: "color",
    label: L("탈색", "ブリーチ", "Bleach"),
    basePriceFrom: 100000,
  },
  {
    id: "clinic_treatment",
    categoryId: "clinic",
    label: L("트리트먼트", "トリートメント", "Treatment"),
    basePriceFrom: 50000,
  },
  {
    id: "styling_dry",
    categoryId: "styling",
    label: L("드라이/스타일링", "ブロー/セット", "Blow-dry / Styling"),
    basePriceFrom: 30000,
  },
  {
    id: "styling_magic",
    categoryId: "styling",
    label: L("매직/볼륨매직", "ストレートパーマ", "Straightening"),
    basePriceFrom: 90000,
  },
];

/** 살롱별 메뉴 시드 id 는 `${salonSlug}:${catalogId}` 로 충돌 없이 분리. */
function seedMenuFor(salonSlug: string): {
  categories: SalonServiceCategory[];
  services: SalonService[];
} {
  const categories = SEED_CATEGORIES.map((c) => ({
    id: `${salonSlug}:${c.id}`,
    salonSlug,
    label: { ...c.label },
    sort: c.sort,
  }));
  const services = SEED_SERVICES.map((s) => ({
    id: `${salonSlug}:${s.id}`,
    salonSlug,
    categoryId: `${salonSlug}:${s.categoryId}`,
    label: { ...s.label },
    basePriceFrom: s.basePriceFrom,
    rankPrices: s.rankPrices ? { ...s.rankPrices } : undefined,
    active: true,
  }));
  return { categories, services };
}

function freshStore(): Store {
  const salons = new Map<string, Salon>();
  for (const s of DEMO_SALONS) salons.set(s.slug, s);
  const designers = new Map<string, Designer>();
  for (const d of DEMO_DESIGNERS) designers.set(d.id, d);
  const serviceCategories = new Map<string, SalonServiceCategory>();
  const services = new Map<string, SalonService>();
  for (const s of DEMO_SALONS) {
    const { categories, services: svcs } = seedMenuFor(s.slug);
    for (const c of categories) serviceCategories.set(c.id, c);
    for (const v of svcs) services.set(v.id, v);
  }
  return {
    salons,
    designers,
    serviceCategories,
    services,
    consultations: new Map(),
    byConsultationToken: new Map(),
    byDesignerToken: new Map(),
    byReportToken: new Map(),
    messages: new Map(),
    reports: new Map(),
    pushSubs: new Map(),
    errors: [],
  };
}

const g = globalThis as unknown as { __sotongStore?: Store };
const store: Store = (g.__sotongStore ??= freshStore());
// HMR 로 살아남은 구버전 store 호환 — 새 필드가 없으면 깐다.
store.pushSubs ??= new Map();

/** 무인증 접근 토큰 — 절단 없이 192bit 랜덤(base64url). 추측/열거 차단(P0/P1-36). */
const token = () => randomBytes(24).toString("base64url");
const now = () => new Date().toISOString();

export class MemoryRepo implements Repo {
  readonly driver = "memory";

  async getSalon(slug: string): Promise<Salon | null> {
    return store.salons.get(slug) ?? null;
  }

  async listSalons(): Promise<Salon[]> {
    return [...store.salons.values()];
  }

  async getSalonByOwnerToken(t: string): Promise<Salon | null> {
    if (!t) return null;
    for (const s of store.salons.values()) {
      if (s.ownerToken === t) return s;
    }
    return null;
  }

  async createSalon(input: CreateSalonInput): Promise<Salon> {
    const salon: Salon = {
      slug: input.slug,
      name: input.name,
      nameTranslations: input.nameTranslations,
      locales: input.locales ?? ["ja", "en", "ko"],
      entryKeyVersion: 1,
      address: input.address,
      tel: input.tel,
      businessHours: input.businessHours,
      placementLabel: input.placementLabel,
      designerRanks: input.designerRanks ?? DEMO_RANKS.map((r) => ({ ...r })),
      ownerToken: `owner_${token()}`,
    };
    store.salons.set(salon.slug, salon);
    return salon;
  }

  async getDesignerByStaffToken(t: string): Promise<Designer | null> {
    if (!t) return null;
    for (const d of store.designers.values()) {
      if (d.staffToken === t) return d;
    }
    return null;
  }

  async getDesignerById(id: string): Promise<Designer | null> {
    if (!id) return null;
    return store.designers.get(id) ?? null;
  }

  async listDesigners(salonSlug: string): Promise<Designer[]> {
    return [...store.designers.values()].filter(
      (d) => d.salonSlug === salonSlug,
    );
  }

  async createDesigner(input: CreateDesignerInput): Promise<Designer> {
    const designer: Designer = {
      id: input.id ?? `d_${token()}`,
      salonSlug: input.salonSlug,
      name: input.name,
      staffToken: input.staffToken ?? `staff_${token()}`,
      entryKeyVersion: 1,
      rankId: input.rankId,
    };
    store.designers.set(designer.id, designer);
    return designer;
  }

  async updateDesigner(designer: Designer): Promise<void> {
    if (store.designers.has(designer.id)) {
      store.designers.set(designer.id, { ...designer });
    }
  }

  /* ── 살롱별 시술 카탈로그 ───────────────────────────────── */
  async listServiceCategories(
    salonSlug: string,
  ): Promise<SalonServiceCategory[]> {
    return [...store.serviceCategories.values()]
      .filter((c) => c.salonSlug === salonSlug)
      .sort((a, b) => a.sort - b.sort);
  }

  async listServices(salonSlug: string): Promise<SalonService[]> {
    return [...store.services.values()].filter(
      (s) => s.salonSlug === salonSlug,
    );
  }

  async upsertServiceCategory(category: SalonServiceCategory): Promise<void> {
    store.serviceCategories.set(category.id, { ...category });
  }

  async upsertService(service: SalonService): Promise<void> {
    store.services.set(service.id, { ...service });
  }

  async deleteService(id: string): Promise<void> {
    store.services.delete(id);
  }

  async createConsultation(
    input: CreateConsultationInput,
  ): Promise<Consultation> {
    const id = randomUUID();
    const consultation: Consultation = {
      id,
      salonSlug: input.salonSlug,
      designerId: input.designerId,
      designerName: input.designerName,
      customerLocale: input.customerLocale,
      status: "intake",
      phone: input.phone,
      isReturning: input.isReturning,
      intake: input.intake,
      consultationToken: token(),
      designerToken: token(),
      createdAt: now(),
    };
    store.consultations.set(id, consultation);
    store.byConsultationToken.set(consultation.consultationToken, id);
    store.byDesignerToken.set(consultation.designerToken, id);
    store.messages.set(id, []);
    return consultation;
  }

  async assignConsultation(
    consultationId: string,
    designer: { id: string; name: string },
  ): Promise<void> {
    const c = store.consultations.get(consultationId);
    if (c) {
      c.designerId = designer.id;
      c.designerName = designer.name;
    }
  }

  async listConsultations(
    opts?: ListConsultationsOptions,
  ): Promise<Consultation[]> {
    let list = [...store.consultations.values()];
    if (opts?.salonSlug)
      list = list.filter((c) => c.salonSlug === opts.salonSlug);
    if (opts?.designerId)
      list = list.filter((c) => c.designerId === opts.designerId);
    if (opts?.unassignedOnly) list = list.filter((c) => !c.designerId);
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return opts?.limit ? list.slice(0, opts.limit) : list;
  }

  async getByConsultationToken(t: string): Promise<Consultation | null> {
    const id = store.byConsultationToken.get(t);
    return id ? (store.consultations.get(id) ?? null) : null;
  }

  async getByDesignerToken(t: string): Promise<Consultation | null> {
    const id = store.byDesignerToken.get(t);
    return id ? (store.consultations.get(id) ?? null) : null;
  }

  async getByReportToken(t: string): Promise<Consultation | null> {
    const id = store.byReportToken.get(t);
    return id ? (store.consultations.get(id) ?? null) : null;
  }

  async updateStatus(id: string, status: ConsultationStatus): Promise<void> {
    const c = store.consultations.get(id);
    if (c) c.status = status;
  }

  async setSummary(id: string, summary: DesignerSummary): Promise<void> {
    const c = store.consultations.get(id);
    if (c) c.summary = summary;
  }

  async setReportToken(id: string, reportToken: string): Promise<void> {
    const c = store.consultations.get(id);
    if (c) {
      c.reportToken = reportToken;
      store.byReportToken.set(reportToken, id);
    }
  }

  async addMessage(msg: NewMessage): Promise<Message> {
    const message: Message = {
      ...msg,
      id: randomUUID(),
      createdAt: msg.createdAt ?? now(),
    };
    const arr = store.messages.get(msg.consultationId) ?? [];
    arr.push(message);
    store.messages.set(msg.consultationId, arr);
    return message;
  }

  async listMessages(
    consultationId: string,
    sinceIso?: string,
  ): Promise<Message[]> {
    const arr = store.messages.get(consultationId) ?? [];
    return sinceIso ? arr.filter((m) => m.createdAt > sinceIso) : [...arr];
  }

  async saveReport(report: HairReport): Promise<void> {
    store.reports.set(report.reportToken, report);
  }

  async getReport(reportToken: string): Promise<HairReport | null> {
    return store.reports.get(reportToken) ?? null;
  }

  /* ── 디자이너 웹푸시 구독 ─────────────────────────────────── */
  async savePushSubscription(input: NewPushSub): Promise<void> {
    // endpoint 가 고유 키 — 같은 디바이스 재구독은 덮어쓴다(upsert).
    const existing = store.pushSubs.get(input.endpoint);
    store.pushSubs.set(input.endpoint, {
      id: existing?.id ?? randomUUID(),
      designerId: input.designerId,
      staffToken: input.staffToken,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      createdAt: existing?.createdAt ?? now(),
    });
  }

  async listPushSubscriptions(designerId: string): Promise<PushSub[]> {
    return [...store.pushSubs.values()].filter(
      (s) => s.designerId === designerId,
    );
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    store.pushSubs.delete(endpoint);
  }

  async logError(entry: NewErrorLog): Promise<ErrorLog> {
    const log: ErrorLog = {
      ...entry,
      id: randomUUID(),
      createdAt: entry.createdAt ?? now(),
    };
    store.errors.unshift(log);
    if (store.errors.length > 500) store.errors.length = 500;
    return log;
  }

  async listErrors(opts?: ListConsultationsOptions): Promise<ErrorLog[]> {
    let list = store.errors;
    if (opts?.salonSlug)
      list = list.filter((e) => e.salonSlug === opts.salonSlug);
    return opts?.limit ? list.slice(0, opts.limit) : [...list];
  }
}
