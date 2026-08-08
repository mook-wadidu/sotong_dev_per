-- ─────────────────────────────────────────────────────────────────────────────
-- 0038 — 손님 앱 푸시 토큰
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ## 왜 `push_subscriptions` 에 안 붙이는가
--
-- 그 테이블은 **디자이너 웹푸시 전용**이다 — `designer_id`·`staff_token` 이 not null
-- 이고 `endpoint`·`p256dh`·`auth` 가 VAPID 키다. 손님 Expo 토큰은 소유자도(계정 vs
-- 디자이너) 전송 규격도(Expo Push API vs VAPID) 다르다. `kind` 컬럼 하나로 합치면
-- 절반이 not null 인 채 비어 있고, 발송 코드가 매번 어느 절반인지 물어야 한다.
--
-- ## 기기 단위다. 계정 단위가 아니다
--
-- 한 사람이 폰과 태블릿을 쓴다(1:N). 그리고 **한 기기를 여러 사람이 쓸 수도 있다** —
-- 그래서 유일 키는 계정이 아니라 **토큰**이고, 다른 계정이 같은 기기에서 로그인하면
-- 행이 그 계정으로 옮겨간다(upsert on conflict).
--
-- 🔴 **로그아웃은 행을 지워야 한다.** 안 지우면 로그아웃한 폰에 다음 예약 확정
-- 알림이 뜬다 — 잠금화면에 매장명과 시술이 그대로 나온다. 「알림이 안 온다」는
-- 불편이지만 「남의 폰에 뜬다」는 사고다.

create table if not exists public.app_push_tokens (
  id          uuid primary key default gen_random_uuid(),

  -- 계정을 지우면 토큰도 사라진다. 예약(`on delete set null`)과 반대로 잡은 이유:
  -- 예약은 매장 약속이라 남아야 하지만, 알림 받을 곳은 계정이 없으면 존재 이유가 없다.
  -- 이 cascade 가 파기 경로(`lib/retention/purge.ts`)를 자동으로 완결시킨다.
  user_id     uuid not null references public.app_users(id) on delete cascade,

  -- Expo 가 발급한 기기 토큰(`ExponentPushToken[...]`). **이게 기기의 신원이다.**
  expo_token  text not null unique,

  platform    text not null check (platform in ('ios', 'android')),

  -- 🔴 계정 로케일이 아니라 **기기 로케일**이다. 일본 손님이 한국 여행 중 폰을
  -- 한국어로 쓸 수 있고, 알림은 폰이 읽히는 언어로 떠야 한다. 메일은 계정 로케일,
  -- 푸시는 기기 로케일 — 둘은 같은 값이 아니다.
  locale      text,

  -- 죽은 토큰 정리용. Expo 가 `DeviceNotRegistered` 를 돌려주면 그 행은 지운다.
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists idx_app_push_tokens_user
  on public.app_push_tokens (user_id);

comment on table public.app_push_tokens is
  'MAKEDOL 손님 앱 푸시 토큰. 기기 단위(1계정:N기기). 로그아웃 시 삭제한다 — 안 지우면 로그아웃한 폰에 예약 알림이 뜬다.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 권한 — `0035`·`0037` 과 같은 자세. anon/authenticated 에는 아무것도 주지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.app_push_tokens enable row level security;
alter table public.app_push_tokens force row level security;

create policy srv_app_push_tokens on public.app_push_tokens
  for all to service_role using (true) with check (true);

grant all on public.app_push_tokens to service_role;
