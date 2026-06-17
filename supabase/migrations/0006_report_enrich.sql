-- 헤어 리포트 보강 — 손님 리포트에 요청 스타일/고민/주의 노출(고객 리포트 풍부화).
-- HairReportDraft 신규 optional 필드(styleRequest/concerns/cautions)의 영속 컬럼.
-- 비파괴·멱등: add column if not exists (nullable). 기존 리포트 안전.
alter table public.hair_reports
  add column if not exists style_request text;
alter table public.hair_reports
  add column if not exists concerns text;
alter table public.hair_reports
  add column if not exists cautions text;
