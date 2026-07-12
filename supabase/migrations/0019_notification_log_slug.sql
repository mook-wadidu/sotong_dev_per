-- 0019_notification_log_slug — 알림 발송 현황 계측용.
-- notification_logs 는 0001에 존재하나 앱 write가 없었다. salon_slug(앱 slug 중심)를
-- 추가해 notifyDesigner 발송 결과를 기록 → 어드민 "알림 발송 현황". 비파괴·멱등.

alter table public.notification_logs add column if not exists salon_slug text;
alter table public.notification_logs add column if not exists designer_id text;
create index if not exists idx_notification_logs_slug_created
  on public.notification_logs(salon_slug, created_at desc);
