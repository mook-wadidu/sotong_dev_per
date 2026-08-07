-- 0033: 디자이너를 "상품" 으로 보여줄 수 있게 한다.
--
-- ── 무엇이 바뀌고 무엇이 안 바뀌나 ─────────────────────────────────────
--
--   살롱이 **주체**다 — 계약·정산·손님 데이터 보유·RLS 스코프. 그대로 둔다.
--   디자이너가 **상품**이다 — 손님이 보고 고르는 것. 여기가 비어 있었다.
--
--   (아고다: 호텔이 주체, 객실 타입이 상품. 배민: 가게가 주체, 메뉴가 상품.)
--
--   `bookings` 는 이미 이 모델이다 — `salon_id`(확정 시 필수)와 `designer_id` 가
--   둘 다 있고 이중예약 방지도 두 축으로 걸려 있다(0022). 스키마가 이미 맞고
--   화면이 디자이너를 상품으로 안 보여줬을 뿐이다.
--
--   `staff.salon_id NOT NULL` 은 **건드리지 않는다.** 소속은 항상 있고 바꿀 수만
--   있으면 된다. QR 진입 토큰·getSalonDesigners·bookings_confirmed_needs_salon
--   이 전부 그대로 산다.

-- ── (1) 공개 신원 ───────────────────────────────────────────────────────
--
--   is_public 기본 false 인 이유: **동의 없이 사람 이름과 얼굴을 공개 카탈로그에
--   올리지 않는다.** salon_design_photos.consent_ack_at(0023) 과 같은 원칙이고,
--   기본값이 true 면 명단을 넣는 순간 전원이 공개된다.
--
--   name_translations 가 필요한 이유: staff.name 은 한국어 단일 문자열이라
--   일본 손님이 한글 이름을 본다. 디자이너가 상품이 되는 순간 이건 치명적이다.
--   (salons 에는 name_translations 가 이미 있는데 staff 에만 없었다.)
--
--   specialties 는 text[] 로 둔다 — 태그 몇 개면 되고, 별도 테이블을 만들면
--   지금 없는 관리 화면이 하나 더 필요해진다.
alter table public.staff
  add column if not exists name_translations     jsonb    not null default '{}'::jsonb,
  add column if not exists photo_path            text,
  add column if not exists headline              text,
  add column if not exists headline_translations jsonb    not null default '{}'::jsonb,
  add column if not exists specialties           text[]   not null default '{}'::text[],
  add column if not exists is_public             boolean  not null default false,
  add column if not exists sort_order            smallint not null default 0;

-- ── (2) 디자이너별 메뉴 ─────────────────────────────────────────────────
--
--   지금은 salon_services 가 살롱별이고 디자이너는 rank_prices[rank_id] 로
--   **직급 단위 보정만** 한다. 즉 직급이 같으면 가격이 같다 — 실제로는 같은
--   원장이라도 사람마다 다르다.
--
--   새 테이블(designer_services)을 만들지 않는 이유가 셋이다.
--     ① bookings.salon_service_id 가 이 테이블을 FK 로 가리킨다. 쪼개면
--        "무엇을 예약했나" 가 두 테이블로 갈린다
--     ② salon_design_photos.salon_service_id 도 같다 — 사진→메뉴→가격 연결이
--        그 FK 하나로 서 있다
--     ③ 기존 행이 그대로 산다 (designer_id IS NULL = 살롱 공통 메뉴)
--
--   가격 해석 순서: 디자이너 행 → rank_prices[rank_id] → base_price_from.
alter table public.salon_services
  add column if not exists designer_id text;

-- ── (3) 소속 이동이 UPDATE 한 줄이 되게 ─────────────────────────────────
--
--   salon_slug 가 staff·salon_services·salon_design_photos 세 곳에 비정규화돼
--   있어서, 디자이너가 샵을 옮길 때 손으로 셋을 맞춰야 하고 하나라도 놓치면
--   조용히 어긋난다.
--
--   복합 FK + ON UPDATE CASCADE 가 두 가지를 동시에 한다.
--     ① staff.salon_slug 만 바꾸면 메뉴가 따라온다
--     ② 디자이너 메뉴가 엉뚱한 살롱에 붙는 걸 **DB 가** 막는다 (앱 검사에
--        기대지 않는다)
--
--   designer_id IS NULL 인 행은 FK 가 걸리지 않는다(NULL 피연산자 = 검사 안 함).
alter table public.staff
  drop constraint if exists staff_id_salon_slug_uniq;
alter table public.staff
  add constraint staff_id_salon_slug_uniq unique (id, salon_slug);

alter table public.salon_services
  drop constraint if exists salon_services_designer_same_salon;
alter table public.salon_services
  add constraint salon_services_designer_same_salon
  foreign key (designer_id, salon_slug)
  references public.staff (id, salon_slug)
  on update cascade on delete cascade;

create index if not exists idx_salon_services_designer
  on public.salon_services (designer_id)
  where designer_id is not null;

-- 홈의 디자이너 섹션이 쓰는 조회. 부분 인덱스라 공개 0명인 동안 비용이 0이다.
create index if not exists idx_staff_public
  on public.staff (salon_slug, sort_order)
  where is_public and is_active;
