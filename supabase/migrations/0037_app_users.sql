-- 0037 — 손님 계정 (MAKEDOL)
--
-- ## 왜 소통 마이그레이션 체인에 넣는가
--
-- 이 테이블을 쓰는 건 MAKEDOL 이다. 그런데 MAKEDOL 의 `supabase/migrations/` 는
-- **한 번도 적용된 적이 없는 죽은 디렉터리**고, 체인을 둘로 가르면 2026-08-07 에
-- 증명한 「레포만으로 프로덕션 스키마가 재현된다」(스크래치 `db reset` → 468컬럼
-- 완전 일치)가 **그날로 깨진다.** 재현 가능한 체인 하나가 스키마 사고에서
-- 되돌아갈 유일한 길이라 그걸 지킨다.
--
-- ⚠️ 소유권은 다른 얘기다. **소통 코드는 이 테이블을 읽지도 쓰지도 않는다.**
-- 체인만 공유하고 결합은 만들지 않는다(`docs/pilot/운영-결정.md` §2 의 역방향 결합
-- 규칙과 같은 선).
--
-- ## 왜 profiles 를 재사용하지 않는가
--
-- `profiles` 는 2026-08-07 부터 **어드민 접근 제어 테이블**이다(`getAdminUser` 가
-- `profiles.role='admin'` 을 본다). 거기에 손님 행을 섞으면 신뢰 경계가 흐려지고,
-- MAKEDOL 이 소통 소유 테이블에 쓰기 시작하는 역방향 결합이 생긴다.
--
-- ## 왜 auth.users 만으로는 부족한가
--
-- `user_metadata` 는 조인도 집계도 안 된다. 쿠폰이 사용자 단위로 붙을 자리가
-- 필요하고(앱·웹 공용), 그 앵커가 이 테이블이다.

create table if not exists public.app_users (
  -- auth.users 와 같은 id 를 쓴다. 별도 대리키를 두면 둘이 어긋날 수 있다.
  id                uuid primary key references auth.users(id) on delete cascade,

  -- 소문자 정규화해 저장한다. 조회도 딱 그만큼만 한다 —
  -- plus 주소·점 접기 같은 "관대한" 정규화를 더하면 정상 손님이 영구히 잠긴다
  -- (`lib/booking/reveal.ts` 의 normalizeEmail 과 같은 규칙).
  email             text not null,

  display_name      text,

  -- 확정 메일·안내를 어느 언어로 보낼지. 로그인 시점 로케일로 갱신한다.
  locale            text,

  -- 🔴 마케팅 수신은 **명시적 옵트인**이다. 기본 false.
  -- 예약에 필요한 거래성 메일(확정·결제)은 이 값과 무관하게 나간다.
  marketing_opt_in  boolean     not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 이메일 유일성. 저장을 소문자로 통일하지만 인덱스에서도 한 번 더 접어
-- 대소문자 다른 중복 계정이 생기지 않게 한다.
create unique index if not exists ux_app_users_email
  on public.app_users (lower(email));

comment on table public.app_users is
  'MAKEDOL 손님 계정. auth.users 1:1. 쿠폰·알림이 사용자 단위로 붙는 앵커. 소통 코드는 참조하지 않는다.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 예약 ↔ 계정
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ **`on delete set null` 이다. cascade 가 아니다.**
-- 손님이 계정을 지워도 **예약은 남아야 한다** — 매장에 잡혀 있는 실제 약속이고,
-- 정산·노쇼 기록의 근거다. 계정 삭제가 매장 일정을 조용히 지우면 안 된다.
--
-- null 은 게스트 예약이다. 계정 없이 예약하는 길은 계속 열어둔다(파일럿이 재는 건
-- 「손님이 사전작성을 하는가」인데 가입 장벽을 세우면 그 지표가 오염된다).
-- 게스트 예약을 나중에 계정에 소급 연결하는 기능은 **만들지 않는다** — 이메일
-- 일치만으로 붙이면 오늘 만든 2요소 관문(`revealBooking`)을 가입으로 우회하게 된다.
alter table public.bookings
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

comment on column public.bookings.auth_user_id is
  '예약 시점에 로그인돼 있었으면 그 계정. null = 게스트 예약. 소급 연결하지 않는다.';

-- `/me` 의 유일한 조회 패턴: 내 예약을 최신순으로.
create index if not exists idx_bookings_auth_user
  on public.bookings (auth_user_id, created_at desc)
  where auth_user_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 권한 — `0035` 와 같은 자세. anon/authenticated 에는 아무것도 주지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 손님 데이터 접근은 **전부 서버(service_role)를 지난다.** 브라우저가 자기 행을
-- 직접 읽는 길을 열면 RLS 하나가 유일한 방어선이 되는데, `0035` 가 그 구조를
-- 걷어낸 참이다.
alter table public.app_users enable row level security;
alter table public.app_users force row level security;

create policy srv_app_users on public.app_users
  for all to service_role using (true) with check (true);

grant all on public.app_users to service_role;
revoke all on public.app_users from anon, authenticated;

-- updated_at 자동 갱신
create or replace function public.touch_app_users_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_app_users_touch on public.app_users;
create trigger trg_app_users_touch
  before update on public.app_users
  for each row execute function public.touch_app_users_updated_at();
