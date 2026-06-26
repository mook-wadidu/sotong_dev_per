-- 0008_training_samples — 비식별 ML 학습 샘플 적재 테이블.
-- 비파괴·멱등(create if not exists). 원본 상담은 retention 으로 90일 후 파기되지만,
-- 이 테이블은 PII(전화·사진·이름·자유텍스트·얼굴) 없이 가명·통계 데이터만 담아
-- AI 학습 자산으로 영구 축적한다. 학습 옵트인 동의(intake.trainingConsentedAt) 건만 적재.

create table if not exists public.training_samples (
  id                 uuid primary key default gen_random_uuid(),
  salon_slug         text not null,
  -- 가명: customerId 의 비가역 해시(entrySecret salt). 재방문 연결만, 재식별 불가.
  customer_pseudonym text not null,
  visited_at         timestamptz not null default now(),
  -- coarse 인구통계 (재식별 위험 완화 — 정확 나이 대신 연령대)
  nationality        text,         -- 손님 언어 로케일 프록시(en/ja/zh/ko)
  gender             text,
  age_band           text,         -- "10s".."60s+"
  -- 모발 특징(비식별)
  face_shape         text,
  crown_volume       text,
  hair_density       text,
  hair_type          text,
  concern_ids        text[] not null default '{}'::text[],
  allergy            boolean not null default false,
  -- 시술 + 결과(라벨)
  service_ids        text[] not null default '{}'::text[],
  products           text[] not null default '{}'::text[],
  state_grade        text,
  hair_state_score   int,
  satisfaction_score int,
  next_visit_weeks   int,
  created_at         timestamptz not null default now()
);

create index if not exists idx_training_samples_salon
  on public.training_samples(salon_slug);
create index if not exists idx_training_samples_pseudonym
  on public.training_samples(customer_pseudonym);
create index if not exists idx_training_samples_visited
  on public.training_samples(visited_at desc);

alter table public.training_samples enable row level security;
alter table public.training_samples force row level security;
