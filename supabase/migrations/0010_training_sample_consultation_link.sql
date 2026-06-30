-- 0010: training_samples.consultation_id (손님 별점 후입력 → 학습 샘플 연결)
-- 완결 시 생성되는 training_sample 은 customer_pseudonym 만 가져, 완결 후 도착한
-- 손님 별점(만족도)을 해당 샘플에 다시 붙일 키가 없다. consultation_id 를 추가해
-- 별점 도착 시 그 샘플을 찾아 satisfaction_score 를 갱신한다(만족도=학습 정답 신호).
--
-- 비식별 보존: consultation_id 는 평가 연결용 '조인키'일 뿐 → retention 90일 퍼지 시
-- 코드(scrubConsultationPii 경로)가 이 값을 NULL 로 끊어, 영구 자산에 재식별 링크를
-- 남기지 않는다. 그래서 하드 FK(on delete) 대신 단순 text 컬럼으로 둔다.
alter table public.training_samples
  add column if not exists consultation_id text;

-- 별점 갱신은 consultation_id 로 조회/업데이트하므로 인덱스.
create index if not exists training_samples_consultation_id_idx
  on public.training_samples (consultation_id);
