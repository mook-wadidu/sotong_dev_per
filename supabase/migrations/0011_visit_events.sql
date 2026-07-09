-- 유입(홍보) 방문 이벤트 — 리플렛 QR 직접진입 추적(어드민 확인용).
-- 리플렛 QR 은 순수 `/ko/demo`(표식 없음, 이미 인쇄 배포됨)로 들어오므로,
-- URL 쿼리로는 홈 클릭 유입과 QR 유입을 구분할 수 없다.
-- 대신 서버가 요청 헤더 `Sec-Fetch-Dest: document`(= 최상위 문서 직접 로드)인
-- /demo 진입만 기록한다 → 홈에서의 SPA 클릭(sec-fetch-dest: empty)·프리페치는 제외.
create table if not exists public.visit_events (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,            -- 'qr' (리플렛 QR 직접진입 추정)
  path        text not null,            -- 진입 경로 (예: /ko/demo)
  referrer    text,                     -- Referer 헤더(있으면)
  created_at  timestamptz not null default now()
);

create index if not exists idx_visit_events_created
  on public.visit_events (created_at desc);
create index if not exists idx_visit_events_source
  on public.visit_events (source);

-- 보안: 서버(service_role)만. anon/authenticated 무정책 → 차단.
alter table public.visit_events enable row level security;
alter table public.visit_events force row level security;
create policy visit_events on public.visit_events
  for all
  to service_role
  using (true)
  with check (true);
grant all on public.visit_events to service_role;
