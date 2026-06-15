-- 디자이너 웹푸시 구독 (PWA + Web Push / VAPID)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  designer_id text not null,
  staff_token text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_sub_designer
  on public.push_subscriptions (designer_id);

-- 보안: 서버(service_role)만. anon/authenticated 무정책 → 차단.
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
grant all on public.push_subscriptions to service_role;
