/**
 * 런타임 설정 — env로 드라이버를 전환한다.
 * 기본값은 "제로 셋업" (인메모리 DB + mock AI) 이라 `pnpm dev`만으로 핵심 루프가 돈다.
 */

const IS_PROD = process.env.NODE_ENV === "production";
// next build 단계는 모듈 init 시 NODE_ENV=production 이지만 "부팅/서빙"이 아니다.
// 빌드 중에는 시크릿이 주입되기 전일 수 있으므로 fail-fast 를 건너뛴다(런타임 부팅에서 강제).
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

/**
 * dev 전용 기본 시크릿 — 운영에서는 절대 사용 금지(아래 가드가 부팅 시 차단).
 * 공개 repo 에 박힌 값이므로 "비밀"이 아니다. dev/데모 루프 편의용일 뿐.
 */
const DEV_ENTRY_SECRET = "sotong-dev-entry-secret-change-me";
const DEV_ADMIN_TOKEN = "sotong-dev-admin";

const rawEntrySecret = process.env.SOTONG_ENTRY_SECRET ?? "";
const rawAdminToken = process.env.SOTONG_ADMIN_TOKEN ?? "";

/**
 * 시크릿 fail-fast 가드(P0).
 * 운영(NODE_ENV=production)에서 entrySecret/adminToken 이 비었거나 dev 기본값이면
 * 부팅을 막는다(위조 입장토큰·공개 어드민 키로의 전권 탈취 방지).
 * dev 에서는 경고만 — 데모 루프는 그대로 돈다.
 */
function resolveSecret(
  name: string,
  raw: string,
  devDefault: string,
): string {
  const isMissing = raw.trim() === "";
  const isDevDefault = raw === devDefault;
  if (IS_PROD && !IS_BUILD_PHASE && (isMissing || isDevDefault)) {
    throw new Error(
      `[sotong] ${name} 가 설정되지 않았거나 dev 기본값입니다. ` +
        `운영에서는 반드시 강한 랜덤값(예: openssl rand -base64 32)으로 설정하세요.`,
    );
  }
  if (!IS_PROD && (isMissing || isDevDefault)) {
    console.warn(
      `[sotong] ${name} 가 dev 기본값으로 가동됩니다 — 운영 배포 전 반드시 교체하세요.`,
    );
  }
  return isMissing ? devDefault : raw;
}

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

  /** QR 입장 토큰 서명 시크릿 (HMAC). 운영은 반드시 env로 교체(가드가 부팅 시 강제). */
  entrySecret: resolveSecret("SOTONG_ENTRY_SECRET", rawEntrySecret, DEV_ENTRY_SECRET),

  /** 어드민 접근 키 (MVP: 단일 공유 키). 운영은 반드시 env로 교체(가드가 부팅 시 강제). */
  adminToken: resolveSecret("SOTONG_ADMIN_TOKEN", rawAdminToken, DEV_ADMIN_TOKEN),

  /** 절대 URL 생성용 (QR 등). 비면 클라이언트 origin 사용. */
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "",

  /** 데모 살롱 slug (시드와 일치) */
  demoSalonSlug: process.env.DEMO_SALON_SLUG ?? "salon-demo",

  /**
   * PII 파기 크론 보호 시크릿(PIPA). Vercel Cron 이 보내는
   * `Authorization: Bearer <CRON_SECRET>` 검증용. 비면 크론 라우트는 무인증
   * 호출을 모두 거부(파기 잡이 외부에서 트리거되지 않게).
   */
  cronSecret: process.env.CRON_SECRET ?? "",

  /** 웹푸시(VAPID) — 디자이너 알림. 키 없으면 푸시 비활성(앱은 정상). */
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@sotong.app",
} as const;

export type AppConfig = typeof config;
