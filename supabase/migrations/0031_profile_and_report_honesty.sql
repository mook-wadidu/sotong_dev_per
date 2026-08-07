-- 0031: 소통 자체의 세 구멍.
--
-- ── (1) customer_hair_profiles.gender / age ───────────────────────────────
--   프로필에 성별·나이가 없어서 재방문 손님이 매번 다시 답한다. 값은
--   consultations.intake jsonb 안에만 있고 프로필로 넘어가지 않는다.
--   클라이언트는 이미 이 필드를 방어적으로 읽고 있다 —
--   intake-stepper.tsx:125 "프로필이 추후 이 필드를 실으면 그때 프리필되도록".
--   그래서 컬럼만 추가하면 기존 코드가 그대로 켜진다.
--   age 에 CHECK 를 걸지 않는 이유: 손님이 직접 넣는 값이고, 범위를 좁게 잡으면
--   경계에서 인테이크가 통째로 막힌다. 표시용이지 계산용이 아니다.

alter table public.customer_hair_profiles
  add column if not exists gender text,
  add column if not exists age    int;

-- ── (2) consultations.sensitive_consented_at ──────────────────────────────
--   민감정보(알레르기 등 건강정보) 수집 동의는 지금 intake jsonb 안에만 있다.
--   동작 자체는 견고하다 — 미동의면 서버가 저장 전에 알레르기 필드를 지운다
--   (service.ts, PIPA §23 별도동의). 문제는 운영이다: jsonb 안에 있으면
--   "동의자 목록" 을 뽑을 수 없어 보유기간 관리·삭제요청 대응이 실무적으로
--   불가능하다. 법무 검토 항목이라 조회 가능한 컬럼으로 승격한다.
--
--   ★ 규칙: **앞으로 이 컬럼이 정본이다.** 같은 값이 intake jsonb 안에도
--     남지만(앱이 인테이크 초안을 그대로 들고 다니기 때문), "누가 언제
--     동의했는가" 를 답할 때는 항상 이 컬럼을 쓴다. jsonb 쪽은 레거시 사본으로
--     취급하고 컴플라이언스 조회에 쓰지 않는다 — 그러지 않으면 0031 이전 행과
--     이후 행의 집계 방식이 갈려 같은 질문에 답이 두 개가 된다.
--     쓰는 곳: supabase.ts createConsultation (같은 규칙이 거기에도 적혀 있다).
--     백필 안 함 — 이전 행은 내부 테스트 3건뿐이라 값어치가 없다(전부 NULL).

alter table public.consultations
  add column if not exists sensitive_consented_at timestamptz;

-- ── (3) hair_reports.state_estimated ★ 지금 손님에게 거짓을 말하고 있다 ────
--   HairReport.stateEstimated 는 도메인 타입(types.ts)에 있는데 컬럼이 없다.
--   메모리 드라이버는 객체째 보관해 살아남지만 supabase 드라이버는 저장도
--   조회도 하지 않는다. 그런데 프로덕션은 supabase 로 돌고 있다.
--
--   이 플래그가 하는 일: 디자이너가 모발 등급을 입력하지 않으면 서버가
--   stateEstimated=true 로 표시하고, report-view 가 점수 행을 숨긴다
--   ("조작 점수를 빼고 생략"). 그 억제가 지금 동작하지 않는다.
--
--   2026-08-05 실측 — 발송된 리포트 2건 중 1건이 거짓이었다:
--     acf2a59a  treatment_records.state_grade='mid'  → 리포트 mid/68   정직
--     a1ea9a4e  treatment_records.state_grade= NULL  → 리포트 mid/68   ★거짓
--   (둘 다 내부 테스트 건이라 실손님 피해는 없었다. 다음 리포트는 아니다.)
--
--   기본값을 두지 않는다(NULL = 모름). 읽는 쪽(toHairReport)이 NULL 을 "추정"
--   으로 해석한다 — 두 방향의 손해가 대칭이 아니라서다: 진짜 측정값을 감추는
--   건 정보 손실이지만, 지어낸 값을 측정값처럼 보여주는 건 손님에게 하는 거짓말이다.
--   모르면 주장하지 않는다.

alter table public.hair_reports
  add column if not exists state_estimated boolean;

-- 기존 2행은 백필했다(2026-08-05). 추측이 아니라 파생이다 — 디자이너가 등급을
-- 입력했는지가 treatment_records.state_grade 에 그대로 남아 있다.
--   acf2a59a  state_grade='mid'  → false (측정값, 점수 표시 유지)
--   a1ea9a4e  state_grade= NULL  → true  (추정값, 점수 숨김 ★거짓이 사라진 지점)
update public.hair_reports r
set state_estimated = (t.state_grade is null)
from public.treatment_records t
where t.consultation_id = r.consultation_id
  and r.state_estimated is null;
