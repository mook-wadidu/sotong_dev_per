/**
 * 외부 시스템이 상담에 붙이는 참조를 **읽어들이는 유일한 지점.**
 *
 * 소통은 이 값을 해석하지 않는다 — 받아서 저장하고 물으면 돌려줄 뿐이다.
 * 그래서 이름도 발급자 중립적으로 둔다(MAKEDOL 전용이 아니다).
 *
 * ── 왜 함수로 감싸는가 ───────────────────────────────────────────────
 * 지금 몸통은 쿼리스트링 읽기다. 다음 단계에서 발급 API 가 생기면
 * "발급 레코드 조회" 로 몸통만 바뀐다. 그때 인테이크 페이지를 다시 열지
 * 않으려고 지금 경계를 긋는다. 발급 쪽(MAKEDOL `getIntakeUrl`)과 대칭이다.
 *
 * ── 왜 인테이크 페이지에서만 읽는가 ──────────────────────────────────
 * 발급 URL 은 언어 선택 화면을 건너뛰고 인테이크로 직행한다. 언어 선택
 * 화면(`language-choices.tsx`)이 `customerIntakePath()` 로 URL 을 새로
 * 만들면서 쿼리를 버리기 때문이다. 그 파일은 직접 방문·QR 경로가 쓰므로
 * 손대지 않고, 대신 발급 URL 이 그 단계를 지나가지 않게 한다.
 * (언어 변경은 인테이크 안의 `LocaleSwitch` 로 계속 가능하다.)
 */

/** Next 15+ 의 searchParams 형태. */
type SearchParams = Record<string, string | string[] | undefined>;

export interface ExternalRefs {
  /** 발급자 쪽의 **건** 하나(예: 예약 한 건). */
  externalRef: string | null;
  /** 발급자가 식별한 **주체**(사람). 지금은 항상 null. */
  subjectRef: string | null;
}

/**
 * 길이 상한. 불투명 값이라 내용을 검사하지 않지만, 무한정 받아 컬럼에 넣지는
 * 않는다. 넘으면 통째로 버린다 — 잘라서 저장하면 발급자가 조회할 때 안 맞는
 * 값이 남아 "붙었는데 안 붙은" 상태가 된다. 없는 게 낫다.
 */
const MAX_LEN = 128;

function one(v: string | string[] | undefined): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > MAX_LEN) return null;
  // 제어문자만 거른다. 그 외에는 해석하지 않는다(불투명 값이므로).
  // 리터럴 제어문자를 소스에 넣지 않는다 — 이 레포에서 전에 그 때문에 정규식이
  // 조용히 깨진 적이 있다. 이스케이프로만 쓴다.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(t)) return null;
  return t;
}

export function resolveExternalRef(searchParams: SearchParams): ExternalRefs {
  return {
    externalRef: one(searchParams.ref),
    subjectRef: one(searchParams.subject),
  };
}
