import "server-only";
import { createSsrServerClient } from "@/lib/supabase/ssr-server";
import { getRepo } from "@/lib/db";

/**
 * 어드민 게이트 — 기존 공유키 세션과 병행하는 추가 경로.
 *
 * 세션이 없으면 getUser() 가 null → getAdminUser() 도 null → 기존 공유키
 * (`sotong_admin`) 경로가 그대로 유지된다(비파괴). 두 경로는 **OR** 다.
 *
 * ── 권한의 출처는 이메일이 아니라 DB 행이다 ──────────────────────────────
 *
 * 예전에는 `ADMIN_ALLOWLIST` 에 이메일이 있으면 어드민이었다. 그건 **그 이메일로
 * 계정이 생기기만 하면 어드민**이라는 뜻이고, 계정이 어떻게 생겼는지는 보지 않았다.
 * 실제로 `bill@wadidu.com` 은 허용목록에 있는데 auth 유저가 없었다 — 누구든 그
 * 이메일로 가입만 하면 어드민이 되는 상태였다.
 *
 * 이제 **`profiles.role = 'admin'`** 을 본다. 그 행은 대시보드/직접 SQL 로만 만들 수
 * 있다 — `provisionAccount` 호출부 6곳이 전부 `designer`/`owner` 만 넘기므로
 * **가입 경로는 `admin` 에 구조적으로 도달할 수 없다.** MAKEDOL 의
 * `requireOperator()` 가 이미 같은 방식이라 두 제품이 같은 규칙으로 수렴한다.
 *
 * ⚠️ **`profiles.role` 은 이제 접근 제어다.** 지금까지는 아무도 갱신하지 않는 필드였고
 * (디자이너가 오너가 돼도 `designer` 로 남는다) 그래서 자유롭게 만져도 됐지만,
 * 이제는 아니다. **role 은 명시적 UPDATE 로만 바꾼다 — upsert 금지.**
 * `upsertProfile` 은 `onConflict:"id"` 라 role 을 덮어쓴다.
 *
 * ⚠️ 반환값이 `{ email }` 인 것을 유지한다. `service.ts` 의 고객센터 메모가
 * `support_notes.author` 에 이 이메일을 쓴다 — boolean 으로 바꾸면 작성자가
 * 조용히 undefined 가 된다.
 */

/**
 * 자가발급 차단용 허용목록. **권한 부여용이 아니다** — 그건 `profiles.role` 이 한다.
 *
 * 이 목록의 유일한 역할은 `selfProvisionBlocked` 가 "이 이메일로는 자가가입·초대
 * 수락을 못 하게" 막는 것이다. 어드민이 쓸 주소를 남이 선점하지 못하게 한다.
 */
const ADMIN_EMAIL_RESERVED = ["bill@wadidu.com", "mook@wadidu.com"];

/**
 * 예약된 어드민 이메일인지(대소문자 무시).
 * 자가가입/초대가 이 주소로 계정을 발급하지 못하게 차단하는 데만 쓴다.
 */
export function isAdminEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return ADMIN_EMAIL_RESERVED.some((a) => a.toLowerCase() === e);
}

/**
 * 유효한 어드민 세션이 있으면 `{ email }`, 없으면 null.
 *
 * 조건 셋을 모두 만족해야 한다:
 *   1. Supabase Auth 세션이 있다
 *   2. **이메일이 확인됐다** (`email_confirmed_at`)
 *   3. **`profiles.role === 'admin'`**
 *
 * 2번은 3번과 중복 방어다 — 앱이 만드는 계정은 `createUser({email_confirm:true})`
 * 라 전부 확인 완료 상태다. 유의미한 건 anon 키로 GoTrue 를 직접 친 계정뿐이고
 * 그건 3번이 이미 막는다. 그래도 넣는다: **확인 설정이 나중에 꺼져도 코드가 막는다.**
 *
 * 어떤 실패든 null 을 반환한다(비파괴 — 공유키 경로로 폴백).
 */
export async function getAdminUser(): Promise<{ email: string } | null> {
  try {
    const supabase = createSsrServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const email = user?.email;
    if (!email) return null;

    // 확인되지 않은 계정은 세션이 있어도 어드민이 아니다.
    if (!user?.email_confirmed_at) return null;

    // 권한의 출처. 이메일이 아니라 이 행이다.
    const profile = await getRepo().getProfileByEmail(email);
    if (profile?.role !== "admin") return null;

    return { email };
  } catch {
    return null;
  }
}
