-- 소통(Sotong) — 0004 데이터 엔진 코어
-- 손님 식별(기기 토큰) + 인바디 카르테(treatment_record) 누적 + 재방문("지난번처럼")
--
-- 설계(계획서 polished-dancing-tarjan.md / PRD §4·§8·§10.1·§12)
--  * 기기 토큰 = httpOnly 쿠키(sotong_did). customer 는 (salon_id, device_token) 으로 살롱별 유일.
--  * 미인증 전화번호는 신원 앵커 아님 — phone 은 라벨 only.
--  * 카르테 누적 단위 = treatment_record(completeConsultation 에서 1방문 1행).
--  * ML-ready/심층방어용 salon_id 정합(nullable + 백필 + 인덱스). NOT NULL 강제는 하지 않는다.
--  * RLS 는 0001 그대로(service_role 전용 default-deny) — 새 정책 불필요.
--
-- 비파괴·멱등: add column if not exists / create index if not exists 만 사용.
-- 기존 행은 안전(새 컬럼은 nullable 또는 default). 메인이 supabase db push 로 적용 + 백필.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. customers — 기기 토큰(신원 앵커) + 살롱별 유일 인덱스
--    salon_slug 는 도메인 Customer.salonSlug 라운드트립용(consultations 와 동일 패턴).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.customers
  add column if not exists device_token text;
alter table public.customers
  add column if not exists salon_slug text;

-- salon_slug 백필(부모 salon_id → salons.slug).
update public.customers c
  set salon_slug = s.slug
  from public.salons s
  where c.salon_id = s.id and c.salon_slug is null;

-- (salon_id, device_token) 살롱별 유일. device_token 있는 행만(부분 유니크).
create unique index if not exists ux_customers_salon_device
  on public.customers (salon_id, device_token)
  where device_token is not null;
-- 앱 조회 경로(getCustomerByDeviceToken) 는 salon_slug + device_token.
create index if not exists idx_customers_salon_slug_device
  on public.customers (salon_slug, device_token)
  where device_token is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. treatment_records — 카르테 1방문 1행. 손님/살롱/디자이너/시술/만족도/방문시각 보강.
--    (0001 기존 컬럼: consultation_id, products, state_grade, note, created_at)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.treatment_records
  add column if not exists customer_id uuid
    references public.customers(id) on delete set null;
alter table public.treatment_records
  add column if not exists salon_id uuid
    references public.salons(id) on delete cascade;
alter table public.treatment_records
  add column if not exists salon_slug text;
alter table public.treatment_records
  add column if not exists designer_id text
    references public.staff(id) on delete set null;
alter table public.treatment_records
  add column if not exists designer_name text;
alter table public.treatment_records
  add column if not exists service_ids text[] not null default '{}'::text[];
alter table public.treatment_records
  add column if not exists satisfaction_score int;
alter table public.treatment_records
  add column if not exists visited_at timestamptz not null default now();

-- 기존 행 백필: 부모 consultation 으로 salon/customer/designer/visited_at 채움.
update public.treatment_records tr
  set salon_id    = coalesce(tr.salon_id, co.salon_id),
      salon_slug  = coalesce(tr.salon_slug, co.salon_slug),
      customer_id = coalesce(tr.customer_id, co.customer_id),
      designer_id = coalesce(tr.designer_id, co.designer_id)
  from public.consultations co
  where tr.consultation_id = co.id
    and (tr.salon_id is null or tr.salon_slug is null
         or tr.customer_id is null or tr.designer_id is null);

-- visited_at 백필(기존 행은 생성시각으로).
update public.treatment_records
  set visited_at = created_at
  where visited_at is null;

create index if not exists idx_treatment_records_customer
  on public.treatment_records (customer_id);
create index if not exists idx_treatment_records_salon
  on public.treatment_records (salon_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ML-ready/심층방어 salon_id 정합 (nullable + 백필 + 인덱스, NOT NULL 강제 안 함)
--    customer_hair_profiles → customers.salon_id
--    hair_reports/photos/messages → consultations.salon_id
--    message_translations → messages → consultations.salon_id
-- ─────────────────────────────────────────────────────────────────────────────

-- 3-1. customer_hair_profiles
alter table public.customer_hair_profiles
  add column if not exists salon_id uuid
    references public.salons(id) on delete cascade;
update public.customer_hair_profiles hp
  set salon_id = c.salon_id
  from public.customers c
  where hp.customer_id = c.id and hp.salon_id is null;
create index if not exists idx_hair_profiles_salon
  on public.customer_hair_profiles (salon_id);

-- 3-2. hair_reports
alter table public.hair_reports
  add column if not exists salon_id uuid
    references public.salons(id) on delete cascade;
update public.hair_reports hr
  set salon_id = co.salon_id
  from public.consultations co
  where hr.consultation_id = co.id and hr.salon_id is null;
create index if not exists idx_hair_reports_salon
  on public.hair_reports (salon_id);

-- 3-3. photos
alter table public.photos
  add column if not exists salon_id uuid
    references public.salons(id) on delete cascade;
update public.photos p
  set salon_id = co.salon_id
  from public.consultations co
  where p.consultation_id = co.id and p.salon_id is null;
create index if not exists idx_photos_salon
  on public.photos (salon_id);

-- 3-4. messages
alter table public.messages
  add column if not exists salon_id uuid
    references public.salons(id) on delete cascade;
update public.messages m
  set salon_id = co.salon_id
  from public.consultations co
  where m.consultation_id = co.id and m.salon_id is null;
create index if not exists idx_messages_salon
  on public.messages (salon_id);

-- 3-5. message_translations (messages → consultations 경유)
alter table public.message_translations
  add column if not exists salon_id uuid
    references public.salons(id) on delete cascade;
update public.message_translations mt
  set salon_id = m.salon_id
  from public.messages m
  where mt.message_id = m.id and mt.salon_id is null;
create index if not exists idx_message_translations_salon
  on public.message_translations (salon_id);

-- RLS: 0001 의 service_role 전용 default-deny 정책이 테이블 단위로 이미 적용됨.
-- 새 컬럼은 행 접근 정책에 영향 없음(컬럼 추가는 기존 정책 그대로). 새 정책 불필요.
