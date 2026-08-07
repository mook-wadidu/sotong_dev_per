-- 0032: 외부 시스템이 상담에 붙이는 불투명 참조 두 개.
--
--   소통은 이 값들을 **해석하지 않는다.** 받아서 저장하고, 물으면 돌려줄 뿐이다.
--   그래서 MAKEDOL 전용 필드가 아니라 일반 필드로 정의한다 — 다른 클라이언트도
--   같은 방식으로 쓸 수 있어야 하고, 소통 코드에는 bookings 참조가 0건으로 남는다
--   (단방향 원칙: 0030 헤더 참조).
--
-- ── 왜 둘인가 ────────────────────────────────────────────────────────────
--
--   external_ref          이 **건**을 가리킨다. 발급자 쪽의 거래 하나(MAKEDOL 이면
--                         예약 한 건)에 대응한다. 수명이 그 건과 같다.
--
--   external_subject_ref  이 **주체**를 가리킨다. 발급자가 식별한 사람이고,
--                         건을 가로질러 유지된다.
--
--   지금은 두 번째가 항상 NULL 이다 — 사람 단위 식별자를 만드는 인증 기능이 아직
--   없다. 그래도 지금 넣는 이유는 소급 데이터 때문이 **아니다**(파일럿 건은 어느
--   쪽이든 전부 NULL 이라 소급 대상이 0건이다). 이유는 **수신 인터페이스가
--   "발급자가 식별한 주체" 라는 개념을 갖고 태어나는가**다. 없이 태어나면 나중에
--   인터페이스를 고치게 되고, 그 인터페이스가 소통 독립성을 지키는 경계다.
--
-- ── 왜 유니크가 아닌가 ───────────────────────────────────────────────────
--
--   손님이 인테이크를 두 번 제출하면 같은 external_ref 를 가진 상담이 둘 생긴다.
--   그때 소통이 실패하면 **발급자 쪽 사정으로 소통이 깨지는** 것이다. 어느 상담을
--   그 건에 붙일지는 발급자가 정한다(MAKEDOL 은 created_at 최신 우선).
--
-- ── 왜 intake jsonb 에 얹지 않는가 ───────────────────────────────────────
--
--   인덱스가 안 걸려 조회가 안 되고, 리텐션 스크럽(retention.ts)이 intake 를
--   스프레드로 보존해 알 수 없는 키가 살아남는다. 0031 에서
--   sensitive_consented_at 을 컬럼으로 승격한 것과 같은 이유다.

alter table public.consultations
  add column if not exists external_ref         text,
  add column if not exists external_subject_ref text;

-- 조회는 항상 "이 ref 를 가진 최신 상담" 형태다. 부분 인덱스라 NULL 인 동안
-- 사실상 비어 있고(비용 0), created_at desc 를 포함해 정렬까지 인덱스가 받는다.
create index if not exists idx_consultations_external_ref
  on public.consultations (external_ref, created_at desc)
  where external_ref is not null;

create index if not exists idx_consultations_external_subject_ref
  on public.consultations (external_subject_ref, created_at desc)
  where external_subject_ref is not null;
