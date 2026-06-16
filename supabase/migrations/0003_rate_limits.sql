-- 레이트리밋 (고정 윈도우, 공유 스토어) — P0
-- 인메모리 리미터는 서버리스 멀티인스턴스에서 무력(인스턴스마다 카운터 분산 → 상한 ×N).
-- (bucket, window_start) 키로 DB 에 공유 카운터를 두고 원자적으로 +1 한다.
-- 앱은 service_role(BYPASSRLS)로만 접근하므로 RLS 는 default-deny + service_role 전용.

create table if not exists public.rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, window_start)
);

-- 만료 윈도우 청소용(주기적 delete where window_start < now() - interval '1 hour').
create index if not exists idx_rate_limits_window
  on public.rate_limits (window_start);

-- ─────────────────────────────────────────────────────────────────────────────
-- 원자적 증분 RPC — (bucket, window_start) 행을 +1 하고 증가 후 count 반환.
-- insert ... on conflict do update set count = count + 1 returning count 패턴.
-- security definer 로 두어 service_role RPC 호출이 RLS 와 무관하게 동작.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_window_start timestamptz
) returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — enable + force + service_role 전용(anon/authenticated 무정책 = 전면 차단).
-- (service_role 은 BYPASSRLS 지만 0001 과 동일하게 의도를 명시한다.)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;

create policy rate_limits on public.rate_limits
  for all
  to service_role
  using (true)
  with check (true);

grant all on public.rate_limits to service_role;

-- RPC 실행 권한: 앱은 service_role 로만 호출한다. anon/authenticated 에는 부여하지 않음.
revoke all on function public.rate_limit_hit(text, timestamptz) from public;
grant execute on function public.rate_limit_hit(text, timestamptz) to service_role;
