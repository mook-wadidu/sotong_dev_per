/**
 * 런타임 설정 — env로 드라이버를 전환한다.
 * 기본값은 "제로 셋업" (인메모리 DB + mock AI) 이라 `pnpm dev`만으로 핵심 루프가 돈다.
 */

export const config = {
  /** "memory" | "supabase" — 기본 memory */
  dbDriver: (process.env.DB_DRIVER ?? "memory") as "memory" | "supabase",

  /** "mock" | "gemini" — GEMINI_API_KEY 있으면 자동 gemini, 아니면 mock */
  aiProvider: (process.env.AI_PROVIDER ??
    (process.env.GEMINI_API_KEY ? "gemini" : "mock")) as "mock" | "gemini",

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  /** QR 입장 토큰 서명 시크릿 (HMAC). 운영은 반드시 env로 교체. */
  entrySecret: process.env.SOTONG_ENTRY_SECRET ?? "sotong-dev-entry-secret-change-me",

  /** 어드민 접근 키 (MVP: 단일 공유 키). 운영은 반드시 env로 교체. */
  adminToken: process.env.SOTONG_ADMIN_TOKEN ?? "sotong-dev-admin",

  /** 절대 URL 생성용 (QR 등). 비면 클라이언트 origin 사용. */
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "",

  /** 데모 살롱 slug (시드와 일치) */
  demoSalonSlug: process.env.DEMO_SALON_SLUG ?? "salon-demo",

  /** 웹푸시(VAPID) — 디자이너 알림. 키 없으면 푸시 비활성(앱은 정상). */
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@sotong.app",
} as const;

export type AppConfig = typeof config;
