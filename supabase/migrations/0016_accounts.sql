-- 0016_accounts — 살롱·디자이너 이메일+비밀번호 계정(Supabase Auth) 로그인 토대.
-- 개념: 계정(auth.users) · 레지스트리(profiles) · 소속(staff.salon_slug NOT NULL).
-- 미소속 디자이너 = profiles 만 있고 staff 없음. 비파괴·멱등.

-- 1) profiles — auth.users 미러(역할·검색·표시명). 앱단(서비스롤)에서 upsert.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  role         text not null default 'designer',  -- 'owner' | 'designer' | 'admin'
  display_name text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_profiles_email on public.profiles(email);

-- 2) 계정↔레코드 매핑 컬럼.
alter table public.salons add column if not exists owner_email text;
create unique index if not exists idx_salons_owner_email
  on public.salons(owner_email) where owner_email is not null;

alter table public.staff add column if not exists email text;
create unique index if not exists idx_staff_email
  on public.staff(email) where email is not null;

-- 3) RLS force(서버 service-role 전용 — 브라우저 직접접근 차단).
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
