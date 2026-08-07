-- 0034 — 소급이 안 되는 값들
--
-- 이 마이그레이션에 모인 다섯 컬럼의 공통점은 하나다: **파일럿이 시작된 뒤에
-- 붙이면 그 시점부터의 데이터만 남는다.** 나중에 "그 값이 안 남았네" 를 알게
-- 되는 게 최악이라 첫 손님 전에 자리를 만든다. 전부 add column 이라 기존
-- 행·쿼리에 영향이 없다.
--
-- 소유 구분: bookings 는 MAKEDOL 것이고(0022 주석 참조) consultations 는
-- 소통 것이다. 스키마 소유자가 소통이라 파일은 여기 있지만, bookings 쪽
-- 컬럼을 소통 코드가 읽지는 않는다(0030 의 단방향 원칙 유지).

------------------------------------------------------------------------------
-- 1. bookings.attribution — 이 예약이 어디서 왔나
------------------------------------------------------------------------------
-- 지금은 유입 출처가 **아무 데도 안 남는다.** 광고를 켜면 "어떤 소재가 예약을
-- 만들었나" 를 물어야 하는데 답할 근거가 없다.
--
-- 나중에 웹과 앱 중 어느 쪽이 예약 1건당 싸게 먹히는지 비교할 계획인데,
-- 비교의 공통 전환 정의는 booking_events.action='created' 다(이미 있다).
-- 여기 없는 건 "그 1건이 어느 채널에서 왔나" 뿐이라 그것만 더한다.
--
-- jsonb 인 이유: utm 파라미터 집합은 채널마다 다르고 늘어난다. 컬럼으로
-- 박으면 채널이 늘 때마다 마이그레이션이 필요하다.
alter table public.bookings
  add column if not exists attribution jsonb not null default '{}'::jsonb;

comment on column public.bookings.attribution is
  '유입 출처 스냅샷(utm_*·referrer·채널·기기). 예약 생성 시 1회 기록하고 이후 바꾸지 않는다.';

------------------------------------------------------------------------------
-- 2. bookings.is_waitlist — 중개 가능한 장르가 아닌 신청
------------------------------------------------------------------------------
-- 헤어 외 6개 장르는 아직 조율 가능한 매장이 없다(lib/data/categories.ts 의
-- arrangeable=false). 신청은 그대로 받는다 — 그 수요 신호가 매장 협상 카드다.
--
-- 문제는 집계다. 같은 bookings 행이라 **"조율 불가 장르" 가 완결 레코드율의
-- 분모를 먹는다.** 못 채운 게 아니라 애초에 채울 수 없는 건인데 실패로 세어진다.
-- 그리고 어드민 큐에 "처리할 일" 로 뜨는데 실제로는 할 일이 없다.
--
-- 별도 테이블 대신 플래그인 이유: 동의·메일·조회 경로가 전부 bookings 를
-- 지난다. 테이블을 가르면 그 셋을 다시 깔아야 하는데 얻는 게 없다.
alter table public.bookings
  add column if not exists is_waitlist boolean not null default false;

comment on column public.bookings.is_waitlist is
  '중개 가능한 장르가 아닌 신청(대기 등록). 어드민 큐와 완결률 분모에서 제외한다.';

-- 큐와 지표가 매번 이 필터를 탄다. 대기 등록은 소수이므로 부분 인덱스로 충분.
create index if not exists idx_bookings_waitlist
  on public.bookings (created_at desc) where is_waitlist;

------------------------------------------------------------------------------
-- 3~5. consultations — A0(디자이너 자발 수행도) 지표
------------------------------------------------------------------------------
-- 파일럿 구조가 바뀌었다. WADIDU 가 동행하지 않고 매장 디자이너가 직접 소통을
-- 쓴다. 그래서 "디자이너가 시트를 읽었나, 얼마나" 를 사람이 뒤에 서서 재던
-- 방식이 불가능해졌고, 로그로 갈아타야 한다.
--
-- 갈아타려고 보니 넷 중 하나만 온전했다:
--   ✅ designer_viewed_at   (0027) 요약을 연 시점
--   ✅ chat_started_at      (0027) 채팅을 시작한 시점
--   ✅ designer_editing_at  (0028) 첫 입력 시점
--   ❌ 요약 체류시간   — 시작만 있고 **종료가 없다**
--   ❌ 채팅 자발입력량 — 시작 여부만 있고 **얼마나 썼는지가 없다**
--   ❌ 시술 시작 시각 — **컬럼 자체가 없어** 상담→시술 간격을 유도할 수 없다
-- 아래 셋이 그 빈 자리다.

-- 요약에서 벗어난 시각. designer_viewed_at 과의 차이가 체류시간이다.
-- designer_editing_at 과의 차이(=착수까지 걸린 시간)로는 대체할 수 없다 —
-- 그건 "얼마나 읽었나" 가 아니라 "언제 손을 댔나" 다.
alter table public.consultations
  add column if not exists designer_summary_left_at timestamptz;

-- 디자이너가 스스로 입력한 글자 수. 자발성의 크기이고, 시작 여부(boolean)로는
-- "열어만 보고 한 줄 쓰다 말았다" 와 "제대로 상담했다" 가 구분되지 않는다.
-- 내용이 아니라 길이만 센다 — 지표에 상담 원문이 새어들 이유가 없다.
alter table public.consultations
  add column if not exists chat_self_input_chars integer not null default 0;

-- 시술을 시작한 시각. status 전이만으로는 못 낸다(updated_at 은 마지막 변경일
-- 뿐이라 이후 어떤 수정에도 덮인다).
alter table public.consultations
  add column if not exists treatment_started_at timestamptz;

comment on column public.consultations.designer_summary_left_at is
  'A0: 요약 화면을 벗어난 시각. designer_viewed_at 과의 차이가 체류시간.';
comment on column public.consultations.chat_self_input_chars is
  'A0: 디자이너가 직접 입력한 누적 글자 수. 내용은 저장하지 않는다.';
comment on column public.consultations.treatment_started_at is
  'A0: 시술 시작 시각. created_at 과의 차이가 상담→시술 간격.';

-- 음수는 있을 수 없다. 누적 카운터라 클라이언트가 잘못 보내면 지표가 조용히 썩는다.
alter table public.consultations
  drop constraint if exists consultations_chat_chars_nonneg;
alter table public.consultations
  add constraint consultations_chat_chars_nonneg
  check (chat_self_input_chars >= 0);
