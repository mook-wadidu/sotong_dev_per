-- 0030: MAKEDOL 예약 ↔ 소통 통합에 필요한 bookings 확장.
--   소유는 MAKEDOL 이다(소통 코드는 bookings* 를 참조하지 않는다 — 단방향 원칙).
--   스키마가 이 레포에 있는 것은 DB 가 하나이기 때문이고, 의존 방향과는 무관하다.
--
--   * visit_start / visit_end  ⚠️ 예약분 — 현재 수집하지 않는다
--       방한 일정. 만들어는 뒀으나 **폼에서 받지 않기로 했다**(2026-08-05):
--       우리는 예약 대행이지 여행 일정을 받을 이유가 없고, 폼 마찰과 민감정보
--       양쪽에서 손해다. 임박 판단은 희망 일시(booking_slot_prefs)로 한다.
--       컬럼을 남기는 이유는 비용이 0이고, 나중에 필요해지면 그때 폼만 붙이면
--       되기 때문이다. **채우는 코드가 생기기 전까지 계속 NULL 이다.**
--       date 인 이유: "9/12~9/15 사이" 는 시각이 아니라 날짜 구간이다.
--
--   * share_history_consented_at
--       다른 매장에서 받은 시술 이력을 이번 매장에 공유하는 데 대한 별도 동의.
--       기본 비공개 — 미동의면 이전 리포트를 디자이너 화면에 띄우지 않는다.
--       boolean 이 아니라 timestamptz 인 이유: 동의는 "언제" 가 증거다.
--
--   * salon_review_token / salon_responded_at / salon_response
--       확정 전 살롱이 여는 예약 확인 링크. 화면은 첫 매장 계약 시점에 만들지만
--       (지금 계약 매장 0곳) 컬럼은 지금 넣는다 — 비용이 0이고, 나중에 넣으면
--       그때 이미 쌓인 예약에 소급 값이 없다.
--       token 은 owner_token/staff_token 관례를 따라 unique. 단수명이라
--       revoked 컬럼은 두지 않는다(응답하면 끝난다).

alter table public.bookings
  add column if not exists visit_start                date,
  add column if not exists visit_end                  date,
  add column if not exists share_history_consented_at timestamptz,
  add column if not exists salon_review_token         text,
  add column if not exists salon_responded_at         timestamptz,
  add column if not exists salon_response             text;

-- 방한 구간이 거꾸로면 조율 자체가 불가능하다. 한쪽만 있는 것은 허용한다 —
-- "9/12 입국, 귀국일 미정" 이 실제로 흔하다.
alter table public.bookings
  drop constraint if exists bookings_visit_range;
alter table public.bookings
  add constraint bookings_visit_range
  check (visit_start is null or visit_end is null or visit_start <= visit_end);

alter table public.bookings
  drop constraint if exists bookings_salon_response;
alter table public.bookings
  add constraint bookings_salon_response
  check (salon_response is null
         or salon_response in ('accept', 'decline', 'propose'));

-- 응답 내용과 응답 시각은 항상 같이 있거나 같이 없다. 한쪽만 있으면
-- "언제 답했는지 모르는 응답" 또는 "내용 없는 응답" 이 되어 응답시간 측정이 깨진다.
alter table public.bookings
  drop constraint if exists bookings_salon_response_pair;
alter table public.bookings
  add constraint bookings_salon_response_pair
  check ((salon_response is null) = (salon_responded_at is null));

-- 부분 유니크 — NULL 이 대다수라 전체 유니크 인덱스를 만들 이유가 없다.
create unique index if not exists ux_bookings_salon_review_token
  on public.bookings (salon_review_token)
  where salon_review_token is not null;

-- 부분 인덱스라 컬럼이 NULL 인 동안은 사실상 빈 인덱스다(비용 0). 나중에
-- 방한 일정을 실제로 받게 되면 "이 기간에 서울 오는 사람" 조회가 바로 선다.
create index if not exists idx_bookings_visit_start
  on public.bookings (visit_start)
  where visit_start is not null;
