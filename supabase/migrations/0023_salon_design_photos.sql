-- 0023_salon_design_photos — 디자이너가 직접 올리는 "디자인 메뉴 사진" 카탈로그.
--
-- ── 왜 새 테이블인가 ────────────────────────────────────────────────────────
-- 비슷해 보이는 기존 셋은 전부 다른 용도라 재사용할 수 없다.
--
--   photos            상담에 딸린 사진. consultation_id 가 NOT NULL 이라
--                     상담 없이 존재할 수 없다. 카탈로그는 상담 전에 있어야 한다.
--   training_photos   실제 손님의 시술 전/후 학습 데이터. 손님 초상권 동의는
--                     "학습" 범위이지 "마케팅 카탈로그 공개" 범위가 아니다.
--                     이걸 카탈로그로 쓰면 동의 범위를 벗어난다.
--   salon_services    메뉴 자체. 이미지 컬럼이 아예 없다.
--
-- 그래서 **디자이너가 자기 작업물을 스스로 올리는** 별도 구조를 둔다.
-- consent_ack_at 이 책임 이전의 근거다: 업로드 화면에서 "본인 작업물이며 공개에
-- 동의한다"를 명시적으로 받고 그 시각을 남긴다. 이후 초상권·저작권 분쟁의 1차
-- 책임은 업로드한 디자이너에게 있다.
--
-- ── 이게 체험하기(합성)의 입력이다 ──────────────────────────────────────────
-- 손님이 고르는 "이 헤어" = 이 테이블의 한 행이고, 그 행의 salon_service_id 가
-- 곧 시술·가격·디자이너다. 그래서 미리보기 → 예약이 데이터상 끊기지 않는다.
--
-- 비파괴·멱등. 기존 테이블은 어떤 컬럼도 변경/삭제하지 않는다.
-- 0022 가 먼저 적용되어 있어야 한다(bookings 에 FK 를 건다).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 디자인 사진
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.salon_design_photos (
  id                uuid primary key default gen_random_uuid(),

  salon_id          uuid not null references public.salons(id) on delete cascade,
  salon_slug        text not null,   -- 기존 테이블들과 같은 비정규화 관례

  -- 누가 올렸나 = 책임 소재. 디자이너가 퇴사해도 사진의 출처는 남아야 하므로
  -- set null 이 아니라 restrict. 정말 지우려면 사진을 먼저 정리하게 만든다.
  designer_id       text not null references public.staff(id) on delete restrict,

  -- 어떤 메뉴의 결과물인가. 이 FK 가 "고른 사진 → 가격" 을 잇는다.
  -- 메뉴가 개편돼 서비스가 사라져도 사진 자체는 남기므로 set null.
  salon_service_id  text references public.salon_services(id) on delete set null,

  -- Supabase Storage 경로. 버킷명은 앱 설정이고 여기엔 키만 둔다.
  storage_path      text not null,
  width             integer check (width  > 0),
  height            integer check (height > 0),
  byte_size         integer check (byte_size > 0),
  content_type      text check (content_type in ('image/jpeg','image/png','image/webp')),

  label             text,
  label_translations jsonb not null default '{}'::jsonb,

  is_active         boolean not null default true,
  sort_order        smallint not null default 0,

  -- ── 책임 이전의 근거 ──
  -- 업로드 화면에서 받은 확인. NULL 이면 아직 동의 전이므로 공개하면 안 된다.
  consent_ack_at    timestamptz,
  consent_ack_by    text,          -- 확인한 사람(보통 designer_id 와 같다)
  consent_version   text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- 동의 없이 활성화되는 것을 DB 가 막는다. 앱 버그로 빠져나갈 구멍을 남기지 않는다.
  constraint salon_design_photos_active_needs_consent
    check (is_active = false or consent_ack_at is not null)
);

drop trigger if exists trg_salon_design_photos_updated_at on public.salon_design_photos;
create trigger trg_salon_design_photos_updated_at
  before update on public.salon_design_photos
  for each row execute function public.set_updated_at();

create index if not exists idx_salon_design_photos_salon
  on public.salon_design_photos (salon_id, sort_order, created_at desc);
create index if not exists idx_salon_design_photos_slug
  on public.salon_design_photos (salon_slug);
create index if not exists idx_salon_design_photos_designer
  on public.salon_design_photos (designer_id);
create index if not exists idx_salon_design_photos_service
  on public.salon_design_photos (salon_service_id);
-- 손님에게 실제로 보여줄 집합. 부분 인덱스라 비활성·미동의 건은 안 실린다.
create index if not exists idx_salon_design_photos_public
  on public.salon_design_photos (salon_slug, sort_order)
  where is_active and consent_ack_at is not null;
-- 같은 파일을 두 번 올리는 것을 막는다.
create unique index if not exists ux_salon_design_photos_path
  on public.salon_design_photos (storage_path);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 체험하기(합성) 결과
--    손님 원본 사진은 저장하지 않는 것이 기본이다(PRD §10.1 "최소 기간 보관 후
--    즉시 삭제"). 여기 남기는 것은 합성 결과와 비용·모델 메타뿐이고, 원본은
--    source_purged_at 으로 파기 시각만 기록한다.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.design_previews (
  id                uuid primary key default gen_random_uuid(),

  -- 익명 손님도 체험할 수 있어야 하므로 로그인/예약에 매이지 않는다.
  -- 브라우저 세션을 묶는 임의 키. PII 가 아니다.
  session_key       text not null,

  design_photo_id   uuid not null references public.salon_design_photos(id) on delete cascade,
  salon_slug        text not null,

  -- 합성 결과. 원본(손님 얼굴)은 여기 없다.
  result_path       text not null,
  source_purged_at  timestamptz,

  -- 비용 관리 지표(PRD §10.3). 상시 관리 대상이라 행마다 남긴다.
  provider          text,
  model             text,
  cost_usd_micros   integer check (cost_usd_micros >= 0),
  latency_ms        integer check (latency_ms >= 0),

  status            text not null default 'ok'
                      check (status in ('ok','failed')),
  error_code        text,

  created_at        timestamptz not null default now()
);

create index if not exists idx_design_previews_session
  on public.design_previews (session_key, created_at desc);
create index if not exists idx_design_previews_photo
  on public.design_previews (design_photo_id);
create index if not exists idx_design_previews_cost
  on public.design_previews (created_at desc)
  where status = 'ok';
create unique index if not exists ux_design_previews_result_path
  on public.design_previews (result_path);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 예약 ↔ 고른 디자인 연결
--    운영자가 매장에 전달할 실물이 바로 이것이다. 손님이 "이 머리요" 라고 고른
--    사진과 그 합성 결과가 예약 상세에 보여야 한다.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists design_photo_id uuid
    references public.salon_design_photos(id) on delete set null;
alter table public.bookings
  add column if not exists design_preview_id uuid
    references public.design_previews(id) on delete set null;

create index if not exists idx_bookings_design_photo
  on public.bookings (design_photo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — service_role 전용. anon/authenticated 접근 없음.
--    디자인 사진은 "공개" 카탈로그지만 읽기도 서버를 거친다. anon 에게 직접
--    열어주면 미동의·비활성 행까지 필터를 우회해 읽힐 수 있다.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.salon_design_photos enable row level security;
alter table public.design_previews     enable row level security;

drop policy if exists srv_salon_design_photos on public.salon_design_photos;
drop policy if exists srv_design_previews     on public.design_previews;

create policy srv_salon_design_photos on public.salon_design_photos for all to service_role using (true) with check (true);
create policy srv_design_previews     on public.design_previews     for all to service_role using (true) with check (true);

revoke all on public.salon_design_photos from anon, authenticated;
revoke all on public.design_previews     from anon, authenticated;
