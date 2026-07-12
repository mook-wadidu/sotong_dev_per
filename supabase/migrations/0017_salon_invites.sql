-- 0017_salon_invites — 디자이너 초대 링크(단일사용/만료). 소속을 링크가 결정.
-- HMAC stateless 대신 DB(단일사용·revoke·만료) — 유출 시 무제한 가입 방지. 비파괴·멱등.

create table if not exists public.salon_invites (
  token       text primary key,
  salon_slug  text not null references public.salons(slug) on delete cascade,
  created_by  text,                     -- 발급 주체 라벨(오너/어드민)
  expires_at  timestamptz,
  used_at     timestamptz,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_salon_invites_salon on public.salon_invites(salon_slug);

alter table public.salon_invites enable row level security;
alter table public.salon_invites force row level security;
