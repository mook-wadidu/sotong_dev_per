-- 0024_demand_first — 살롱이 아직 없어도 예약 "요청"을 받을 수 있게 한다.
--
-- ── 왜 ──────────────────────────────────────────────────────────────────────
-- 0022/0023 은 "손님이 살롱을 고른다"를 전제로 썼다. 그런데 계약된 살롱이 아직
-- 0곳이고, 후보(adido)도 성사 여부가 미정이다. 그 상태에서 살롱 목록을 보여주면
-- 존재하지 않는 공급을 있는 척하게 된다.
--
-- 그래서 방향을 뒤집는다: 공급을 흉내내지 말고 수요를 먼저 받는다.
-- 손님은 "홍대 / 헤어 / 이 날짜 / 이 예산 / 이런 머리"를 남기고, 사람이 매장을
-- 찾아 배정한다. 모인 요청이 그대로 매장과 협상할 근거가 된다.
--
--   requested(salon_id IS NULL) ──배정──▶ requested(salon_id 있음) ──확정──▶ confirmed
--
-- 요청과 예약은 같은 것의 두 단계이지 다른 개체가 아니다. 그래서 새 테이블을
-- 만들지 않고 bookings.salon_id 를 NULL 허용으로 바꾼다. 배정되면 같은 행이
-- 그대로 예약이 된다.
--
-- 비파괴. bookings 는 현재 0행이라 백필도, NOT VALID 도 필요 없다.
-- 0022·0023 이 먼저 적용돼 있어야 한다.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 수요 정보 컬럼
--    지역·시술 어휘(LOCATION_IDS 6개 / CATEGORY_KEYS 7개)는 앱 상수다. 이태원에
--    매장 하나 계약하는 순간 늘어나므로 DB CHECK 로 못박지 않는다 — 그러면 구가
--    늘 때마다 마이그레이션이 필요해진다. 검증은 앱(create.ts)에서 한다.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists desired_region   text,
  add column if not exists desired_category text,
  add column if not exists budget_max_krw   integer,
  add column if not exists style_ref_url    text;

comment on column public.bookings.desired_region is
  '살롱 미배정 요청에서 손님이 고른 지역. LOCATION_IDS 중 하나(앱에서 검증).';
comment on column public.bookings.budget_max_krw is
  '손님이 밝힌 예산 상한. 하한은 두지 않는다 — 아무도 채울 줄 모르는 칸이다.';

alter table public.bookings drop constraint if exists bookings_budget_shape;
alter table public.bookings add constraint bookings_budget_shape
  check (budget_max_krw is null or budget_max_krw > 0);

-- 길이는 정규식이 아니라 length() 로 건다. POSIX 정규식의 {n,m} 반복 횟수 상한이
-- 255 라 '{3,500}' 은 "invalid repetition count(s)" 로 죽는다(2201B).
alter table public.bookings drop constraint if exists bookings_style_ref_url_shape;
alter table public.bookings add constraint bookings_style_ref_url_shape
  check (
    style_ref_url is null
    or (style_ref_url ~ '^https://[^\s]+$' and length(style_ref_url) between 12 and 500)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. salon_id / salon_slug 를 NULL 허용으로
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings alter column salon_id   drop not null;
alter table public.bookings alter column salon_slug drop not null;

-- ── NOT NULL 을 푸는 순간 잃는 보장을 CHECK 넷으로 되돌린다 ──

-- (1) 둘은 함께 있거나 함께 없다. 어긋나면 조인이 조용히 빈다.
alter table public.bookings drop constraint if exists bookings_salon_shape;
alter table public.bookings add constraint bookings_salon_shape
  check ((salon_id is null) = (salon_slug is null));

-- (2) ★ 확정 이후에는 살롱이 반드시 있어야 한다.
--
--     이 제약은 두 가지를 동시에 지킨다.
--
--     첫째, 명시적으로: 살롱 없이 confirmed 가 되면 손님에게 갈 확정 안내에
--     쓸 매장이 없다.
--
--     둘째, 그리고 이쪽이 자명하지 않은데 — 아래 bookings_no_overlap_salon 은
--     `salon_id with =` 로 키를 잡는다. **배제 제약은 NULL 피연산자를 "충돌 없음"
--     으로 취급한다**(유니크 인덱스와 같은 의미론). 따라서 salon_id 가 NULL 인
--     채로 confirmed 가 되면 살롱 단위 이중예약 방지가 에러도 없이 그냥 동작하지
--     않는다.
--
--     이 CHECK 의 상태 목록(confirmed/completed/no_show)이 배제 제약의 where 상태
--     목록(confirmed/completed)을 완전히 덮으므로, CHECK 를 통과하면서 NULL
--     salon_id 를 배제 인덱스에 들이미는 행은 존재할 수 없다.
--
--     ⚠ 나중에 이 CHECK 를 완화하려는 사람에게: 당신은 이중예약 방지도 함께
--       완화하는 것이다.
alter table public.bookings drop constraint if exists bookings_confirmed_needs_salon;
alter table public.bookings add constraint bookings_confirmed_needs_salon
  check (status not in ('confirmed','completed','no_show') or salon_id is not null);

-- (3) 살롱이 없으면 최소한 어느 지역인지는 있어야 운영자가 움직일 수 있다.
alter table public.bookings drop constraint if exists bookings_salonless_needs_region;
alter table public.bookings add constraint bookings_salonless_needs_region
  check (salon_id is not null or desired_region is not null);

-- (4) 살롱이 없는데 특정 살롱의 메뉴·디자이너가 붙어 있으면 안 된다.
--     salon_service_id 는 '이 예약의 살롱'이 아니라 '어떤 살롱'의 행을 가리키는
--     FK 라, 살롱이 없으면 소속을 대조할 대상 자체가 없다. 조작된 요청이 남의
--     살롱 ₩1,000 짜리 메뉴를 달고 들어와 배정 이후까지 살아남는 걸 막는다.
alter table public.bookings drop constraint if exists bookings_salonless_no_menu;
alter table public.bookings add constraint bookings_salonless_no_menu
  check (salon_id is not null or (salon_service_id is null and designer_id is null));

-- 미배정 요청 큐 — 운영자가 가장 먼저 보는 목록.
create index if not exists idx_bookings_unassigned
  on public.bookings (created_at desc)
  where salon_id is null and status in ('requested','arranging');

-- 이 전환이 존재하는 이유 그 자체: "어디서 뭘 원하는 사람이 몇 명인가".
create index if not exists idx_bookings_demand
  on public.bookings (desired_region, desired_category, created_at desc)
  where salon_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. design_previews — 손님이 직접 올린 참조 사진으로도 합성할 수 있게
--
--    디자이너 사진이 0장이라 지금은 미리보기가 아예 못 뜬다. 손님이 "이런 머리로
--    해주세요" 하며 직접 가져온 사진으로 합성하면 살롱 0곳에서도 돌아가고,
--    "이런 머리를 원한다"가 이미지로 남아 수요 자료가 된다.
--
--    참조 사진 자체는 저장하지 않는다. 손님 얼굴 사진과 똑같이 메모리에서
--    Gemini 로 보내고 버린다 — 남이 찍은 남의 얼굴일 가능성이 높고, 손님에게는
--    그 사람을 대신해 공개에 동의할 자격이 없다. 남기는 건 합성 결과(손님 본인
--    얼굴)뿐이다.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.design_previews alter column design_photo_id drop not null;
alter table public.design_previews alter column salon_slug      drop not null;

alter table public.design_previews
  add column if not exists reference_source          text not null default 'designer',
  add column if not exists reference_consent_at      timestamptz,
  add column if not exists reference_consent_version text,
  add column if not exists guest_email               text,
  add column if not exists email_consent_at          timestamptz,
  -- 클라이언트 IP 의 잘린 sha256. PII 가 아니다.
  -- booking_events.payload.ip_hash 와 같은 관례(create.ts).
  add column if not exists client_hash               text;

comment on column public.design_previews.reference_source is
  '''designer'' = 디자이너가 올린 카탈로그 사진. ''guest'' = 손님이 직접 가져온 참조 사진.';
comment on column public.design_previews.client_hash is
  '레이트리밋용. session_key 는 클라이언트가 정하는 값이라 단독으로는 방어가 안 된다.';

alter table public.design_previews drop constraint if exists design_previews_reference_source;
alter table public.design_previews add constraint design_previews_reference_source
  check (reference_source in ('designer','guest'));

-- 디자이너 경로일 때만 design_photo_id 가 있다. "출처가 손님"은 값의 부재가
-- 아니라 동의 기록이 딸린 사실이어야 한다 — 1년 뒤 권리 문제 제기가 오면
-- 답할 수 있는 쪽은 후자다.
alter table public.design_previews drop constraint if exists design_previews_source_shape;
alter table public.design_previews add constraint design_previews_source_shape
  check ((reference_source = 'designer') = (design_photo_id is not null));

-- salon_design_photos.consent_ack_at 의 손님 쪽 대응물.
alter table public.design_previews drop constraint if exists design_previews_guest_needs_ack;
alter table public.design_previews add constraint design_previews_guest_needs_ack
  check (reference_source = 'designer' or reference_consent_at is not null);

create index if not exists idx_design_previews_email
  on public.design_previews (lower(guest_email))
  where guest_email is not null;
create index if not exists idx_design_previews_client
  on public.design_previews (client_hash, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. campaign_entries — 아이돌 퍼널은 예약이 아니라 추첨 응모가 된다
--
--    데뷔 패키지 가격(₩200,000 / ₩500,000)은 어느 매장도 동의한 적 없는 숫자다.
--    매장이 없는데 가격을 붙여 예약을 받을 수는 없으므로, 그 퍼널은 응모로
--    바꾼다. 응모는 예약이 아니니 bookings 에 넣지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.campaign_entries (
  id              uuid primary key default gen_random_uuid(),
  campaign        text not null,
  email           text not null,
  name            text,
  locale          text not null default 'en',
  consents        jsonb not null default '{}'::jsonb,
  consent_version text,
  -- 당첨 처리는 나중에. 지금은 응모만 받는다.
  won_at          timestamptz,
  notified_at     timestamptz,
  created_at      timestamptz not null default now(),

  constraint campaign_entries_notify_shape
    check (notified_at is null or won_at is not null)
);

-- 같은 캠페인에 같은 이메일은 한 번만.
create unique index if not exists ux_campaign_entries_email
  on public.campaign_entries (campaign, lower(email));
create index if not exists idx_campaign_entries_campaign
  on public.campaign_entries (campaign, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — 기존 테이블과 동일하게 service_role 전용.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.campaign_entries enable row level security;
drop policy if exists srv_campaign_entries on public.campaign_entries;
create policy srv_campaign_entries on public.campaign_entries
  for all to service_role using (true) with check (true);
revoke all on public.campaign_entries from anon, authenticated;
