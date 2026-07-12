-- 0014_admin_ops — 운영 콘솔 Phase 1 기반: 이벤트 트래킹 + 공지 + 분석 인덱스.
-- 비파괴·멱등(create if not exists / add column if not exists).

-- 1) analytics_events — 유입/조회 트래킹(/demo 조회수·QR 스캔·리포트 열람 등).
--    PII 없음(actor 는 어드민 이메일 또는 익명 태그). 마케팅/손님 퍼널 집계용.
create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,          -- 'demo_view' | 'scan' | 'report_view' | 'admin_view' ...
  salon_slug  text,                    -- 관련 살롱(있으면)
  locale      text,                    -- 손님/뷰어 언어
  actor       text,                    -- 어드민 접속 등 식별(선택)
  ctx         jsonb,                   -- 추가 컨텍스트(선택)
  created_at  timestamptz not null default now()
);
create index if not exists idx_analytics_events_created
  on public.analytics_events(created_at desc);
create index if not exists idx_analytics_events_type_created
  on public.analytics_events(event_type, created_at desc);
create index if not exists idx_analytics_events_salon
  on public.analytics_events(salon_slug);

-- 2) announcements — 공지(플랫폼→살롱/디자이너, 손님 대상). i18n jsonb.
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       jsonb not null default '{}'::jsonb,   -- {ko,ja,en,zh}
  body        jsonb not null default '{}'::jsonb,
  audience    text not null default 'salon',         -- 'platform'|'salon'|'customer'
  salon_slugs text[] not null default '{}'::text[],  -- 대상 살롱(빈 배열=전체)
  active      boolean not null default true,
  active_from timestamptz,
  active_to   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_announcements_active
  on public.announcements(active, active_from, active_to);

-- 3) 분석 시계열 인덱스 보강(조사에서 누락 확인).
create index if not exists idx_treatment_records_visited
  on public.treatment_records(visited_at desc);
create index if not exists idx_hair_reports_report_date
  on public.hair_reports(report_date desc);

-- 4) RLS force(서버 service-role 전용).
alter table public.analytics_events enable row level security;
alter table public.analytics_events force row level security;
alter table public.announcements enable row level security;
alter table public.announcements force row level security;
