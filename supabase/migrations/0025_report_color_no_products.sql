-- 0025_report_color_no_products — 손님 헤어 리포트에서 약제를 빼고 색감·실매장명을 넣는다.
--
-- ── 왜 ──────────────────────────────────────────────────────────────────────
-- 손님 리포트(hair_reports)는 지금까지 "사용한 약제(products)"를 실었다. 그런데
-- 약제명은 손님에게 의미가 옅고(전문 용어), 오히려 매장 영업비밀에 가깝다. 손님이
-- 실제로 궁금해하는 건 "무슨 색이 나왔나(색감)"다. 그래서 약제 칸을 리포트 경로에서
-- 통째로 걷어내고, 그 자리에 디자이너가 직접 기록하는 색감(color_result)을 둔다.
--
-- 또 파일럿은 DB 살롱이 단일 계정이라, 실제로 손님이 시술받은 매장명이 DB 살롱명과
-- 다를 수 있다. 리포트 발송 시 디자이너/WADIDU 가 실매장명(salon_display_name)을
-- 손으로 적어 손님 리포트에 그 이름이 뜨게 한다(DB 살롱명 대신).
--
-- ⚠ 이 변경은 hair_reports 에만 적용된다. treatment_records.products /
--   training_samples.products(카르테·학습셋)는 그대로 둔다 — 별개의 자산이다.
--
-- 비파괴. products drop 은 손님 리포트에서 더는 읽지 않으므로 안전하다.

alter table public.hair_reports drop column if exists products;
alter table public.hair_reports add column if not exists color_result text;
alter table public.hair_reports add column if not exists salon_display_name text;

comment on column public.hair_reports.color_result is
  '디자이너가 기록하는 결과 색감(예: "애쉬, 브라운"). 손님 리포트에 표기. 약제(products) 대체.';
comment on column public.hair_reports.salon_display_name is
  '리포트 발송 시 손으로 입력하는 실매장명. 있으면 DB 살롱명 대신 손님 리포트에 표기(파일럿: DB 살롱=단일 계정).';
