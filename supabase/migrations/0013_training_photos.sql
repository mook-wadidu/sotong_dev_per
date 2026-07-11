-- 0009_training_photos — 사진 학습 데이터(비포/애프터·스타일 참고) 적재.
-- 비파괴·멱등. 사진은 DB가 아니라 Storage 비공개 버킷에 두고, 여기엔 메타(경로)만.
-- 셀카/얼굴(생체정보)은 제외. 사진 학습 별도 옵트인(intake.photoTrainingConsentedAt) 건만 적재.
-- 원본 상담은 retention 으로 90일 후 파기되지만, 이 학습 사진은 자산으로 남는다.

-- 1) Storage 비공개 버킷(서버 service-role 로만 접근 — public=false, 정책 불필요).
insert into storage.buckets (id, name, public)
values ('training-photos', 'training-photos', false)
on conflict (id) do nothing;

-- 2) 학습 사진 메타 테이블 — 가명 키(customer_pseudonym) 로만 연결(신원 분리).
create table if not exists public.training_photos (
  id                 uuid primary key default gen_random_uuid(),
  customer_pseudonym text not null,
  salon_slug         text not null,
  -- 'before' | 'after' | 'style'  (셀카/얼굴 없음)
  kind               text not null,
  -- training-photos 버킷 내 객체 경로(서명 URL 로만 접근).
  storage_path       text not null,
  visited_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists idx_training_photos_pseudonym
  on public.training_photos(customer_pseudonym);
create index if not exists idx_training_photos_salon
  on public.training_photos(salon_slug);

alter table public.training_photos enable row level security;
alter table public.training_photos force row level security;
