-- 0022_bookings — 손님용 사전 예약(MAKEDOL 웹 창구)을 소통 데이터 모델에 접합.
--
-- 배경: 소통에는 salons/staff/salon_services/customers/consultations 가 이미 있고
-- "예약"만 없다. MAKEDOL 웹(B2C 예약 창구)이 여기에 쓰고, 방문 시 consultation 이
-- 열리면 booking↔consultation 을 이어 붙인다. 이 연결이 PRD §6.3 "예약 한 건이
-- 곧 데이터 한 건" 의 실체다. 예약 스키마를 MAKEDOL 쪽에 따로 두면 salons/staff/
-- salon_services 의 평행 사본이 생기고 그 조인이 깨지므로, 소유는 소통에 둔다.
--
-- ── 이 스키마가 전제하는 운영 모델 (컨시어지 MVP) ────────────────────────────
-- 손님이 신청할 때 확정 시각은 **없다.** 손님은 희망 일시를 1~3순위로 적고,
-- 운영자가 매장에 전화해 조율한 뒤 확정한다. 확정된 뒤에야 금액이 확정되고
-- 청구가 나간다. 따라서:
--
--   status:          requested → arranging → confirmed → completed
--                                         ↘ cancelled / no_show
--   payment_status:  none → requested → paid | onsite_paid | failed | refunded
--
--   starts_at 은 **confirmed 이후에만** 값이 있다. requested 단계의 희망 일시는
--   booking_slot_prefs 에 순위와 함께 따로 쌓인다. 이 둘을 한 컬럼에 욱여넣으면
--   "손님 희망"과 "매장 확정"이 구분되지 않아 겹침 제약이 거짓 충돌을 낸다.
--
--   금액도 두 개다. price_estimate_krw 는 사이트가 손님에게 **보여준** 값이고,
--   amount_due_krw 는 확정 시 서버가 salon_services 에서 **다시 산출한** 청구액이다.
--   결제 승인은 클라이언트가 보낸 금액이 아니라 amount_due_krw 와 대조해야 한다.
--
-- 함께 넣는 것: 예약 가능 슬롯을 계산하려면 구조화된 영업시간이 필요하다.
-- salons.business_hours 는 자유 텍스트('11:00–21:00 (화 휴무)')이고 adido·chaeyoung
-- 은 비어 있어 슬롯 계산에 쓸 수 없다. 표시용으로 남겨두고 계산용 테이블을 새로 둔다.
--
-- 비파괴·멱등. 기존 테이블은 어떤 컬럼도 변경/삭제하지 않는다.

-- 시술 시간 겹침을 DB 레벨에서 막기 위해 필요(아래 exclude 제약).
create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 예약 상태
--    consultation_status(intake/consulting/in_service/completed/cancelled) 와
--    어휘를 맞춘다. 예약은 방문 전 단계라 requested/arranging/confirmed 가 앞에
--    붙고, 노쇼는 예약에만 있는 종결 상태다.
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.booking_status as enum (
    'requested',   -- 손님이 신청. 아직 아무도 매장에 연락하지 않았다
    'arranging',   -- 운영자가 매장과 일정 조율 중
    'confirmed',   -- 일시 확정. 이 시점부터 starts_at 이 존재한다
    'cancelled',   -- 손님·매장·운영자가 취소(조율 실패 포함)
    'completed',   -- 방문·시술 완료
    'no_show'      -- 미방문
  );
exception when duplicate_object then null; end $$;

-- 주의: 이 마이그레이션은 booking_status 가 **아직 없는** DB 를 전제한다.
-- 타입이 이미 있는데 'arranging' 만 없는 상태라면 여기서 ALTER TYPE ... ADD VALUE
-- 를 하고 싶어지는데, 그러면 같은 트랜잭션 안의 idx_bookings_open_queue 가 방금
-- 추가한 라벨을 참조해 "unsafe use of new value of enum type" 로 죽는다.
-- 그런 DB 를 만나면 ADD VALUE 만 따로 커밋한 뒤 이 파일을 다시 돌려야 한다.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 구조화된 영업시간 / 휴무 / 슬롯 파라미터
--    salons.business_hours(text) 는 인쇄·표시용으로 그대로 두고, 계산은 여기서만.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.salon_hours (
  salon_id   uuid not null references public.salons(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),  -- 0=일 … 6=토
  opens_at   time not null,
  closes_at  time not null,
  constraint salon_hours_pk   primary key (salon_id, weekday),
  constraint salon_hours_span check (closes_at > opens_at)
);
comment on table public.salon_hours is
  '요일별 영업시간. 행이 없는 요일 = 휴무. 자정 넘김은 미지원(미용실 특성상 불필요).';

create table if not exists public.salon_closures (
  id        uuid primary key default gen_random_uuid(),
  salon_id  uuid not null references public.salons(id) on delete cascade,
  from_date date not null,
  to_date   date not null,
  reason    text,
  created_at timestamptz not null default now(),
  constraint salon_closures_span check (to_date >= from_date)
);
create index if not exists idx_salon_closures_lookup
  on public.salon_closures (salon_id, from_date, to_date);

-- 슬롯 격자·예약 지평·선행시간. salons 를 건드리지 않기 위해 1:1 부속 테이블로 둔다.
create table if not exists public.salon_booking_settings (
  salon_id          uuid primary key references public.salons(id) on delete cascade,
  accepts_bookings  boolean not null default false,  -- 마스터 스위치. 기본 OFF.
  slot_minutes      smallint not null default 30 check (slot_minutes between 5 and 240),
  lead_time_minutes int not null default 120 check (lead_time_minutes >= 0),
  horizon_days      smallint not null default 60 check (horizon_days between 1 and 365),
  -- 메뉴에 소요시간이 없어(salon_services 에 컬럼 자체가 없다) 확정 시 기본값으로 쓴다.
  default_duration_min smallint not null default 90
                      check (default_duration_min between 5 and 600),
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_salon_booking_settings_updated_at on public.salon_booking_settings;
create trigger trg_salon_booking_settings_updated_at
  before update on public.salon_booking_settings
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 예약
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),

  -- 손님이 사람에게 불러줄 수 있는 짧은 번호. 인증 수단이 아니다.
  public_code       text not null unique
                      default ('MD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  -- 확인 메일의 관리 링크에 실리는 강한 랜덤. 소통의 *_token 관례를 따른다.
  booking_token     text not null unique,
  booking_token_revoked      boolean not null default false,
  booking_token_last_seen_at timestamptz,
  booking_token_last_seen_ip text,

  status            public.booking_status not null default 'requested',

  -- 소통 모델 접합부. salon_slug 는 기존 테이블들과 같은 비정규화 관례.
  salon_id          uuid not null references public.salons(id) on delete restrict,
  salon_slug        text not null,
  designer_id       text references public.staff(id) on delete set null,   -- 미지정 예약 허용
  salon_service_id  text references public.salon_services(id) on delete set null,
  customer_id       uuid references public.customers(id) on delete set null,
  -- 방문해서 상담이 열리면 이어 붙는다. 이 FK 가 예약↔상담↔리포트 조인의 시작점.
  consultation_id   uuid references public.consultations(id) on delete set null,

  -- ── 확정 시각 ──
  -- requested/arranging 단계에서는 NULL 이다. 손님 희망은 booking_slot_prefs 에 있다.
  -- KST 벽시계로 입력받아 서버가 instant 로 환산해 저장한다. 조회·리마인더·노쇼
  -- 판정이 전부 범위 질의라 timestamptz 가 맞다.
  starts_at         timestamptz,
  duration_min      smallint check (duration_min between 5 and 600),
  -- 겹침 판정용 종료시각. 생성 컬럼으로 두려 했으나 `timestamptz + interval` 은
  -- 세션 타임존에 의존해 STABLE 이라 생성 표현식으로 쓸 수 없다(42P17).
  -- 대신 아래 trg_bookings_ends_at 가 항상 starts_at/duration_min 에서 파생시킨다.
  ends_at           timestamptz,

  -- ── 금액 ──
  -- estimate: 사이트가 손님에게 보여준 값. 참고용이며 청구 근거가 아니다.
  -- due:      확정 시 서버가 salon_services 에서 다시 산출한 청구액. 결제 승인은
  --           반드시 이 값과 대조한다(클라이언트가 보낸 금액을 믿지 않는다).
  price_estimate_krw integer check (price_estimate_krw >= 0),
  amount_due_krw     integer check (amount_due_krw >= 0),
  amount_paid_krw    integer not null default 0 check (amount_paid_krw >= 0),
  party_size         smallint not null default 1 check (party_size between 1 and 4),

  -- ── 결제 ──
  -- cash: 동행한 운영자가 현장에서 수령. toss: 토스페이먼츠 결제창.
  payment_method    text not null default 'cash'
                      check (payment_method in ('cash','toss')),
  payment_status    text not null default 'none'
                      check (payment_status in ('none','requested','paid','onsite_paid','failed','refunded')),
  paid_at           timestamptz,
  payment_key       text,          -- 토스 paymentKey
  payment_order_id  text,          -- 토스 orderId. 유니크로 웹훅 재생을 막는다
  payment_raw       jsonb,         -- 승인 응답 원본 보관(대사·분쟁 대응)

  -- 손님 연락 정보. customers 는 방문 시점에 생성되므로 예약 시점엔 여기에 둔다.
  guest_name        text not null,
  guest_email       text not null,
  guest_phone       text,
  guest_locale      text not null default 'en',
  guest_note        text,                       -- 시술 요청사항(자유 텍스트)

  -- 동의 스냅샷. 어떤 언어로 어떤 버전의 문안에 동의했는지까지 남긴다.
  consents          jsonb not null default '{}'::jsonb,
  consent_locale    text,
  consent_version   text,

  -- 취소·종결
  cancelled_at      timestamptz,
  cancelled_by      text check (cancelled_by in ('guest','salon','operator')),
  cancel_reason     text,

  -- 중복 제출 방지. 같은 키 + 다른 페이로드는 앱에서 충돌로 처리한다.
  idempotency_key   text,
  request_hash      text,

  -- PII 파기. consultations.pii_purged_at 과 같은 관례.
  pii_purged_at     timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint bookings_cancel_shape
    check ((status = 'cancelled') = (cancelled_at is not null)),

  -- 확정 이후 상태는 반드시 시각을 갖는다. 이걸 걸어두지 않으면 starts_at 이 NULL
  -- 인 채로 confirmed 가 되어 겹침 제약도 리마인더도 전부 조용히 통과한다.
  constraint bookings_confirmed_needs_time
    check (status not in ('confirmed','completed','no_show')
           or (starts_at is not null and duration_min is not null)),

  -- ends_at 은 트리거가 파생시킨다. 셋이 함께 있거나 함께 없어야 한다.
  constraint bookings_time_shape
    check ((starts_at is null) = (ends_at is null)
           and (starts_at is null) = (duration_min is null)),

  -- 청구액 없이 결제 상태만 앞서가는 것을 막는다.
  constraint bookings_payment_needs_amount
    check (payment_status = 'none' or amount_due_krw is not null),

  -- 수납이 끝났다면 금액과 시각이 있어야 한다.
  constraint bookings_paid_shape
    check (payment_status not in ('paid','onsite_paid')
           or (paid_at is not null and amount_paid_krw > 0))
);

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ends_at 은 앱이 아니라 DB 가 파생시킨다. 앱이 무엇을 보내든 무시하고 덮어쓰므로
-- duration_min 과 어긋난 구간이 저장될 수 없고, 아래 겹침 제약이 항상 옳게 동작한다.
create or replace function public.set_booking_ends_at() returns trigger
  language plpgsql as $$
begin
  if new.starts_at is null or new.duration_min is null then
    new.ends_at := null;
  else
    new.ends_at := new.starts_at + (new.duration_min * interval '1 minute');
  end if;
  return new;
end $$;

drop trigger if exists trg_bookings_ends_at on public.bookings;
create trigger trg_bookings_ends_at
  before insert or update of starts_at, duration_min on public.bookings
  for each row execute function public.set_booking_ends_at();

-- ── 인덱스 (idx_/ux_ 관례) ──
create index if not exists idx_bookings_salon        on public.bookings (salon_id, starts_at);
create index if not exists idx_bookings_salon_slug   on public.bookings (salon_slug);
create index if not exists idx_bookings_designer     on public.bookings (designer_id, starts_at);
create index if not exists idx_bookings_status       on public.bookings (status);
create index if not exists idx_bookings_starts       on public.bookings (starts_at);
create index if not exists idx_bookings_customer     on public.bookings (customer_id);
create index if not exists idx_bookings_consultation on public.bookings (consultation_id);
create index if not exists idx_bookings_email        on public.bookings (lower(guest_email));
create index if not exists idx_bookings_purge        on public.bookings (created_at)
  where pii_purged_at is null;
-- 운영자 콘솔의 기본 목록: 처리해야 할 것부터. 부분 인덱스라 완료 건은 안 실린다.
create index if not exists idx_bookings_open_queue   on public.bookings (created_at desc)
  where status in ('requested','arranging');
create unique index if not exists ux_bookings_idempotency
  on public.bookings (idempotency_key) where idempotency_key is not null;
-- 토스 orderId 는 웹훅 재생 방지의 핵심이라 유니크.
create unique index if not exists ux_bookings_payment_order
  on public.bookings (payment_order_id) where payment_order_id is not null;

-- ── 이중예약 방지 ──
-- 시작시각 유니크만으로는 막지 못한다. 240분 시술 10:00 과 90분 시술 10:30 은
-- 시작시각이 달라 둘 다 들어가고, 디자이너 한 명이 3.5시간 겹쳐 잡힌다.
-- 확정된 예약(confirmed/completed)끼리 시간 구간이 겹치면 거부한다.
-- requested/arranging 은 아직 시각이 NULL 이므로 애초에 후보가 아니다.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    designer_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('confirmed','completed') and designer_id is not null and starts_at is not null);

-- 디자이너 미지정 예약은 살롱 단위 좌석으로 본다.
alter table public.bookings drop constraint if exists bookings_no_overlap_salon;
alter table public.bookings add constraint bookings_no_overlap_salon
  exclude using gist (
    salon_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('confirmed','completed') and designer_id is null and starts_at is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 희망 일시 (1~3순위)
--    손님이 신청 시 적는 값. 확정 시 운영자가 이 중 하나를 고르거나 직접 입력한다.
--    별도 테이블인 이유: jsonb 배열로 두면 "3순위까지"·"중복 금지"·"과거 금지"를
--    DB 가 강제하지 못하고, 운영자 콘솔에서 순위별 조회도 못 한다.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.booking_slot_prefs (
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  rank         smallint not null check (rank between 1 and 3),
  preferred_at timestamptz not null,
  constraint booking_slot_prefs_pk primary key (booking_id, rank)
);
-- 같은 예약에 같은 시각을 두 순위로 적는 것을 막는다.
create unique index if not exists ux_booking_slot_prefs_at
  on public.booking_slot_prefs (booking_id, preferred_at);
create index if not exists idx_booking_slot_prefs_at
  on public.booking_slot_prefs (preferred_at);
comment on table public.booking_slot_prefs is
  '손님이 신청 시 적은 희망 일시 1~3순위. 확정 시각은 bookings.starts_at 이다.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 이벤트 로그
--    상태 전이·연락·메모·결제를 전부 여기에 남긴다. 운영자 콘솔의 "되돌리기" 와
--    분쟁 대응이 이 로그에 기댄다.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.booking_events (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  actor_type  text not null default 'system'
                check (actor_type in ('guest','operator','salon','system')),
  actor_id    text,
  action      text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_booking_events_booking
  on public.booking_events (booking_id, created_at desc);
create index if not exists idx_booking_events_action
  on public.booking_events (action, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — 기존 테이블과 동일하게 service_role 전용. anon/authenticated 접근 없음.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings               enable row level security;
alter table public.booking_slot_prefs     enable row level security;
alter table public.booking_events         enable row level security;
alter table public.salon_hours            enable row level security;
alter table public.salon_closures         enable row level security;
alter table public.salon_booking_settings enable row level security;

drop policy if exists srv_bookings               on public.bookings;
drop policy if exists srv_booking_slot_prefs     on public.booking_slot_prefs;
drop policy if exists srv_booking_events         on public.booking_events;
drop policy if exists srv_salon_hours            on public.salon_hours;
drop policy if exists srv_salon_closures         on public.salon_closures;
drop policy if exists srv_salon_booking_settings on public.salon_booking_settings;

create policy srv_bookings               on public.bookings               for all to service_role using (true) with check (true);
create policy srv_booking_slot_prefs     on public.booking_slot_prefs     for all to service_role using (true) with check (true);
create policy srv_booking_events         on public.booking_events         for all to service_role using (true) with check (true);
create policy srv_salon_hours            on public.salon_hours            for all to service_role using (true) with check (true);
create policy srv_salon_closures         on public.salon_closures         for all to service_role using (true) with check (true);
create policy srv_salon_booking_settings on public.salon_booking_settings for all to service_role using (true) with check (true);

-- 방어선 이중화: RLS 를 잠시 끄더라도 anon 이 쓰지 못하게.
revoke all on public.bookings               from anon, authenticated;
revoke all on public.booking_slot_prefs     from anon, authenticated;
revoke all on public.booking_events         from anon, authenticated;
revoke all on public.salon_hours            from anon, authenticated;
revoke all on public.salon_closures         from anon, authenticated;
revoke all on public.salon_booking_settings from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. 예약 설정 행 시드 — 모든 살롱에 대해 OFF 로. 영업시간을 넣고 손으로 켠다.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.salon_booking_settings (salon_id)
select id from public.salons
on conflict (salon_id) do nothing;
