-- 0018_membership_requests — 오너가 가입된 디자이너에게 보내는 소속 요청.
-- 디자이너가 수락/거절(동의 기반). 자가가입(profiles) 후 검색→요청→수락 경로. 비파괴·멱등.

create table if not exists public.membership_requests (
  id             uuid primary key default gen_random_uuid(),
  salon_slug     text not null references public.salons(slug) on delete cascade,
  designer_email text not null,
  status         text not null default 'pending',  -- 'pending'|'accepted'|'declined'
  created_at     timestamptz not null default now(),
  responded_at   timestamptz
);
create index if not exists idx_membership_requests_email
  on public.membership_requests(designer_email, status);
create index if not exists idx_membership_requests_salon
  on public.membership_requests(salon_slug, status);

alter table public.membership_requests enable row level security;
alter table public.membership_requests force row level security;
