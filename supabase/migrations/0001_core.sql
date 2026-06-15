-- 소통(Sotong) — 0001 core schema
-- 핵심 루프: 살롱/스태프 → 카탈로그(다국어) → 손님/모발프로필/동의 → 상담(intake/summary jsonb)
--           → 사진/메시지(번역) → 제품/시술기록/헤어리포트 → 알림·에러 로그
--
-- 설계 메모
--  * memory 드라이버(src/lib/db/memory.ts)·도메인 타입(src/lib/domain/types.ts)과 정합.
--  * 손님/디자이너/리포트 접근은 "무인증 + 불투명 토큰 스코프". DB 접근은 전부 service_role(서버).
--    => RLS enable + default deny(anon/authenticated), service_role 만 허용. 심층방어.
--  * intake/summary/translations 처럼 도메인 객체를 통째로 보존하는 곳은 jsonb.
--    카탈로그 라벨 번역은 *_translations jsonb (locale -> text).
--
-- 적용:  supabase start && supabase db reset   (config.toml 의 [db.seed] 가 seed.sql 로드)

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. 확장 / 공통
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;     -- gen_random_uuid()

-- updated_at 자동 갱신용 트리거 함수
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUM
-- ─────────────────────────────────────────────────────────────────────────────
create type public.consultation_status as enum (
  'intake', 'consulting', 'in_service', 'completed', 'cancelled'
);
create type public.face_shape as enum (
  'oval', 'round', 'square', 'long', 'heart', 'diamond'
);
create type public.three_level as enum ('high', 'mid', 'low');
create type public.hair_type   as enum ('straight', 'wavy', 'curly');
create type public.message_sender as enum ('customer', 'designer', 'system');
create type public.error_severity as enum ('info', 'warning', 'error');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. locales (지원 언어 마스터)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.locales (
  code        text primary key,            -- 'ko' | 'ja' | 'en'
  label       text not null,               -- 사람이 읽는 이름 (자국어)
  is_customer boolean not null default true,
  sort_order  int not null default 0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 살롱(테넌트) / 스태프
-- ─────────────────────────────────────────────────────────────────────────────
-- 살롱(그룹/테넌트) — 그룹 메타만. 디자이너(다수)는 staff 로 분리(살롱 1 : 디자이너 N).
create table public.salons (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  name_translations jsonb not null default '{}'::jsonb,  -- {ja, en, ...}
  locales           text[] not null default array['ja','en','ko']::text[],
  -- QR 인쇄/배치용 지점 메타
  address           text,
  tel               text,
  business_hours    text,
  placement_label   text,
  -- 살롱 공용(지정없음) entry_token 키 회전용 버전 (FEEDBACK P0/65)
  entry_key_version int not null default 1,
  -- 디자이너 직급 정의 (Phase1) — [{id,label}] jsonb. 직급별 가격 보정의 키.
  designer_ranks    jsonb not null default '[]'::jsonb,
  -- 살롱 오너 콘솔 접근 토큰 (메뉴/디자이너/직급 편집 권한). 강한 랜덤.
  owner_token       text not null unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_salons_updated_at
  before update on public.salons
  for each row execute function public.set_updated_at();

-- 디자이너(스태프) — 1급 엔티티(살롱 다대일). 도메인 Designer 와 1:1.
--  * id 는 도메인 식별자(text, 예: 'd_sinsa_minji') — 디자이너 QR 토큰에 인코딩.
--  * salon_slug 로도 조회(도메인 정합·쿼리 편의). staff_token uniq. 개인 entry_key_version.
create table public.staff (
  id                text primary key,
  salon_id          uuid not null references public.salons(id) on delete cascade,
  salon_slug        text not null references public.salons(slug) on delete cascade,
  name              text not null,
  staff_token       text not null unique,
  entry_key_version int not null default 1,
  -- 직급 (salons.designer_ranks 의 id). 직급별 가격 보정에 사용. (Phase1)
  rank_id           text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index idx_staff_salon on public.staff(salon_id);
create index idx_staff_salon_slug on public.staff(salon_slug);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 다국어 카탈로그 (계층① 정적) — src/lib/catalog/data.ts 와 동일 id
--    label 은 ko 기준 컬럼 + *_translations(jsonb: locale->text)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.service_categories (
  id                text primary key,
  label_ko          text not null,
  label_translations jsonb not null default '{}'::jsonb,
  icon              text,
  sort_order        int not null default 0
);

create table public.services (
  id                text primary key,
  category_id       text not null references public.service_categories(id) on delete cascade,
  label_ko          text not null,
  label_translations jsonb not null default '{}'::jsonb,
  icon              text,
  price_from        int,                  -- KRW
  sort_order        int not null default 0
);
create index idx_services_category on public.services(category_id);

-- ── 살롱별 편집 가능 카탈로그 (Phase1) ─────────────────────────────────
-- 전역 service_categories/services 와 별개로, 살롱이 콘솔에서 편집하는 메뉴.
-- id 는 도메인에서 `${salonSlug}:${catalogId}` 형태로 충돌 없이 분리(메모리 드라이버와 정합).
create table public.salon_service_categories (
  id                text primary key,
  salon_slug        text not null references public.salons(slug) on delete cascade,
  label_ko          text not null,
  label_translations jsonb not null default '{}'::jsonb,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_salon_service_categories_salon on public.salon_service_categories(salon_slug);
create trigger trg_salon_service_categories_updated_at
  before update on public.salon_service_categories
  for each row execute function public.set_updated_at();

create table public.salon_services (
  id                text primary key,
  salon_slug        text not null references public.salons(slug) on delete cascade,
  category_id       text not null references public.salon_service_categories(id) on delete cascade,
  label_ko          text not null,
  label_translations jsonb not null default '{}'::jsonb,
  -- 기본 시작가(KRW). 직급(rank) 보정 없을 때 적용.
  base_price_from   int not null default 0,
  -- rankId -> 보정가(KRW) (예: {"director": 42000}). 디자이너 직급 일치 시 우선.
  rank_prices       jsonb not null default '{}'::jsonb,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_salon_services_salon on public.salon_services(salon_slug);
create index idx_salon_services_category on public.salon_services(category_id);
create trigger trg_salon_services_updated_at
  before update on public.salon_services
  for each row execute function public.set_updated_at();

create table public.face_shapes (
  id                face_shape primary key,
  label_ko          text not null,
  label_translations jsonb not null default '{}'::jsonb,
  icon              text,
  sort_order        int not null default 0
);

-- crown_volume / hair_density / hair_type / hair_history / concerns:
-- 단순 카탈로그 항목들을 group 으로 구분해 한 테이블에 담는다(스키마 단순화).
create table public.catalog_items (
  group_id          text not null,        -- 'crown_volume'|'hair_density'|'hair_type'|'hair_history'|'concern'
  id                text not null,
  label_ko          text not null,
  label_translations jsonb not null default '{}'::jsonb,
  icon              text,
  sort_order        int not null default 0,
  primary key (group_id, id)
);

-- 퀵리플라이 (계층① 사전 번역). chip_label 은 ko 고정(i18n 밖, catalog/data.ts 주석).
create table public.quick_replies (
  id             uuid primary key default gen_random_uuid(),
  intent         text not null,
  chip_label     text not null,           -- 디자이너가 보는 ko 고정 라벨
  message        jsonb not null,          -- {ko, ja, en} 사전 번역
  needs_value    boolean not null default false,
  value_kind     text,                    -- 'price' | 'time' | null
  sort_order     int not null default 0
);

-- 소요시간 프리셋 (time 퀵리플라이용, 자유 타이핑 제거 P0/11)
create table public.time_presets (
  minutes        int primary key,
  label          jsonb not null,          -- {ko, ja, en}
  sort_order     int not null default 0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 손님 / 모발 프로필 / 동의
-- ─────────────────────────────────────────────────────────────────────────────
create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid references public.salons(id) on delete set null,
  -- 전화는 선택 (관광객은 비움, FEEDBACK P0/4). 연락 불필요 명시.
  phone           text,
  contact_opt_out boolean not null default false,
  locale          text references public.locales(code),
  is_returning    boolean not null default false,
  created_at      timestamptz not null default now()
);
create index idx_customers_salon on public.customers(salon_id);
create index idx_customers_created on public.customers(created_at desc);

create table public.customer_hair_profiles (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  face_shape      face_shape,
  crown_volume    three_level,
  hair_density    three_level,
  hair_type       hair_type,
  -- 가마/뻗침 (Phase1, yes|no|unknown) — 자유 null 허용
  cowlick_whorl    text,
  cowlick_sticking text,
  -- 최근 시술 이력 (Phase1) — [{type,recency}] jsonb (구 hair_history_ids text[] 대체)
  treatment_history jsonb not null default '[]'::jsonb,
  concern_ids     text[] not null default '{}'::text[],
  -- 손님 자유 텍스트 메모 (Phase1, 손님 언어 원문)
  style_note      text,
  concern_note    text,
  allergy         boolean not null default false,
  allergy_note    text,
  created_at      timestamptz not null default now()
);
create index idx_hair_profiles_customer on public.customer_hair_profiles(customer_id);

-- 개인정보·사진 수집 동의 (FEEDBACK P0/5). consultation 과 1:N (재방문 등).
create table public.consents (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.customers(id) on delete set null,
  consultation_id uuid,                   -- 상담 생성 후 연결 (FK 는 아래 consultations 정의 후 추가)
  kind            text not null default 'privacy_photo',
  consented_at    timestamptz not null,
  locale          text,                   -- 동의 시점 손님 언어
  created_at      timestamptz not null default now()
);
create index idx_consents_consultation on public.consents(consultation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 상담 (집계 루트) — intake/summary 는 도메인 객체 통째로 jsonb 보존
-- ─────────────────────────────────────────────────────────────────────────────
create table public.consultations (
  id                 uuid primary key default gen_random_uuid(),
  salon_id           uuid not null references public.salons(id) on delete cascade,
  salon_slug         text not null,        -- 도메인 Consultation.salonSlug (조회 편의·정합)
  -- 배정 디자이너 (살롱 공용 QR 진입은 null=미배정). staff(id) 와 1:N.
  designer_id        text references public.staff(id) on delete set null,
  designer_name      text,
  customer_id        uuid references public.customers(id) on delete set null,
  customer_locale    text not null references public.locales(code),
  status             consultation_status not null default 'intake',
  -- 전화 선택 (손님 뷰 미반환/마스킹은 앱 레이어, FEEDBACK P0/4·37)
  phone              text,
  is_returning       boolean not null default false,
  intake             jsonb not null default '{}'::jsonb,  -- IntakeDraft
  summary            jsonb,                               -- DesignerSummary (AI 산출)
  -- 무인증 접근 토큰 (절단 없이 강한 랜덤, FEEDBACK P0/36)
  consultation_token text not null unique,
  designer_token     text not null unique,
  report_token       text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_consultations_salon on public.consultations(salon_id);
create index idx_consultations_salon_slug on public.consultations(salon_slug);
create index idx_consultations_designer on public.consultations(designer_id);
create index idx_consultations_created on public.consultations(created_at desc);
create index idx_consultations_status on public.consultations(status);
create index idx_consultations_consultation_token on public.consultations(consultation_token);
create index idx_consultations_designer_token on public.consultations(designer_token);
create index idx_consultations_report_token on public.consultations(report_token);
create trigger trg_consultations_updated_at
  before update on public.consultations
  for each row execute function public.set_updated_at();

-- consents.consultation_id FK 를 이제 연결
alter table public.consents
  add constraint consents_consultation_fk
  foreign key (consultation_id) references public.consultations(id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. 사진 / 메시지 / 메시지 번역
-- ─────────────────────────────────────────────────────────────────────────────
create table public.photos (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  -- 'style'(원하는 스타일) | 'before' | 'after'
  kind            text not null default 'style',
  url             text not null,          -- dataURL 또는 storage URL
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index idx_photos_consultation on public.photos(consultation_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  sender          message_sender not null,
  source_text     text not null,          -- 원문 항상 보존
  source_locale   text not null references public.locales(code),
  intent          text,                   -- 퀵리플라이 intent (있으면)
  -- locale -> 번역문 (정규화 사본은 message_translations, 빠른 읽기용 캐시)
  translations    jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index idx_messages_consultation on public.messages(consultation_id);
create index idx_messages_created on public.messages(created_at);
create index idx_messages_consultation_created on public.messages(consultation_id, created_at);

-- 메시지 번역 정규화 테이블 (분석·재번역 추적용; messages.translations 와 동기)
create table public.message_translations (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages(id) on delete cascade,
  locale       text not null references public.locales(code),
  text         text not null,
  created_at   timestamptz not null default now(),
  unique (message_id, locale)
);
create index idx_message_translations_message on public.message_translations(message_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. 제품 / 시술 기록 / 헤어 리포트
-- ─────────────────────────────────────────────────────────────────────────────
-- 살롱이 시술에 쓰는 제품(약제) 인스턴스. 카탈로그(catalog_items group='product')에서 파생 가능.
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid references public.salons(id) on delete cascade,
  catalog_id   text,                      -- PRODUCTS 카탈로그 id (있으면)
  label_ko     text not null,
  label_translations jsonb not null default '{}'::jsonb,
  icon         text,
  created_at   timestamptz not null default now()
);
create index idx_products_salon on public.products(salon_id);

create table public.treatment_records (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  products        text[] not null default '{}'::text[],   -- 사용 제품 라벨
  state_grade     three_level,                            -- 모발 상태 등급
  note            text,
  created_at      timestamptz not null default now()
);
create index idx_treatment_records_consultation on public.treatment_records(consultation_id);

-- 헤어 인바디 리포트 (F11). HairReport 도메인과 1:1, report_token 으로 손님 조회.
create table public.hair_reports (
  id                uuid primary key default gen_random_uuid(),
  consultation_id   uuid not null references public.consultations(id) on delete cascade,
  report_token      text not null unique,
  salon_name        text not null,
  designer_name     text not null,
  locale            text not null references public.locales(code),
  service_summary   text not null,
  products          text[] not null default '{}'::text[],
  hair_state_grade  three_level not null,
  hair_state_score  int not null default 0,
  home_care         text[] not null default '{}'::text[],
  next_visit_weeks  int not null default 0,
  report_date       date not null,
  before_photo_url  text,
  after_photo_url   text,
  created_at        timestamptz not null default now()
);
create index idx_hair_reports_consultation on public.hair_reports(consultation_id);
create index idx_hair_reports_report_token on public.hair_reports(report_token);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. 알림 로그 / 에러 로그
-- ─────────────────────────────────────────────────────────────────────────────
create table public.notification_logs (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid references public.salons(id) on delete set null,
  consultation_id uuid references public.consultations(id) on delete set null,
  channel         text not null default 'web',   -- 'web' | 'sms' | ...
  kind            text not null,                 -- 'report_ready' | 'new_consultation' | ...
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'sent',
  created_at      timestamptz not null default now()
);
create index idx_notification_logs_salon on public.notification_logs(salon_id);
create index idx_notification_logs_created on public.notification_logs(created_at desc);

create table public.error_logs (
  id              uuid primary key default gen_random_uuid(),
  salon_slug      text,
  severity        error_severity not null default 'error',
  source          text not null,           -- 'intake' | 'translate' | 'client' | 'report' ...
  message         text not null,
  detail          text,
  consultation_id uuid references public.consultations(id) on delete set null,
  resolved_at     timestamptz,             -- FEEDBACK P1/34
  created_at      timestamptz not null default now()
);
create index idx_error_logs_salon_slug on public.error_logs(salon_slug);
create index idx_error_logs_created on public.error_logs(created_at desc);
create index idx_error_logs_severity on public.error_logs(severity);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RLS — enable + default deny(anon/authenticated), service_role 만 허용
--     앱은 전부 서버(service role)로 접근하므로 클라 anon 직접 접근은 전면 차단.
--     (service_role 은 RLS 를 우회하지만, 명시적으로 BYPASS 의도를 문서화 + 안전망)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    'locales','salons','staff',
    'service_categories','services','face_shapes','catalog_items',
    'salon_service_categories','salon_services',
    'quick_replies','time_presets',
    'customers','customer_hair_profiles','consents',
    'consultations','photos','messages','message_translations',
    'products','treatment_records','hair_reports',
    'notification_logs','error_logs'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    -- default deny: anon/authenticated 에 어떤 정책도 부여하지 않음(=전부 거부).
    -- service_role 전용 허용 정책 (서버 service role 만 통과).
    execute format($f$
      create policy %1$I on public.%1$I
        for all
        to service_role
        using (true)
        with check (true);
    $f$, t);
    -- 테이블 권한도 service_role 에만 부여(anon/authenticated 에는 미부여 = GRANT 단계에서도 차단).
    -- Supabase 는 보통 service_role 에 암묵 GRANT 하지만, 이식성/명시성을 위해 직접 부여한다.
    execute format('grant all on public.%I to service_role;', t);
  end loop;
end
$$;

-- 시퀀스(SERIAL 미사용이라 사실상 없음) 및 향후 객체 대비 service_role 스키마 접근 보장.
grant usage on schema public to service_role;
