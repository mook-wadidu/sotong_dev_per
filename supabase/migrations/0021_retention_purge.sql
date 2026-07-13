-- 0021_retention_purge — PII 파기 정합 수정(A5).
-- (a) consultations.pii_purged_at — 파기 완료 마커. 선정 쿼리가 오래된순·미파기건만
--     집어 drain 하도록(기존: 최신500·terminal-only → 대다수 레코드 영구 미파기).
-- (b) customer_hair_profiles 자유텍스트도 retention 지나면 파기 대상(방문마다 INSERT 되며
--     기존 파기경로가 건드리지 않던 PII). 별도 스크럽 쿼리가 created_at 기준으로 비운다.
-- 비파괴·멱등.

alter table public.consultations
  add column if not exists pii_purged_at timestamptz;

-- 미파기·오래된순 선정 인덱스(부분 인덱스 — 파기 안 된 것만).
create index if not exists idx_consultations_purge
  on public.consultations (created_at)
  where pii_purged_at is null;
