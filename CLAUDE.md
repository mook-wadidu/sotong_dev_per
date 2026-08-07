@AGENTS.md

# 배포

**배포는 `main` push 다.** Vercel 프로젝트 `sotong-dev-per`, Production Branch = `main`,
GitHub 연동(`mook-wadidu/sotong_dev_per`). 프로덕션 도메인은 `try.makedol.com`.

`vercel build --prod` + `vercel deploy --prebuilt --prod` 는 **긴급 시에만.**
CLI 로 올리는 순간부터 `main` 과 라이브가 갈라지고, **다음 `main` push 가 프로덕션을
그 시점으로 되돌린다.**

## 실제로 그렇게 됐다 (2026-08-07)

프로덕션이 `feat/pilot-flow-prep` 에서 CLI 로만 배포되는 동안 `main` 이 13커밋 뒤처져
있었다. `git push origin main` 한 번에 프로덕션이 **9분간 구버전 `admin-auth.ts`** —
`profiles.role` 게이트가 아니라 이메일 허용목록 게이트 — 로 되돌아갔다.
뚫리지 않은 건 예약된 어드민 이메일이 이미 점유돼 있었기 때문이고, **설계 덕분이 아니다.**

## 지금 라이브가 어느 커밋인지 확인하는 법

`vercel inspect` 출력에는 안 나온다. API 를 본다 — **CLI 배포에도 SHA 가 남는다.**

```bash
TOK=$(python3 -c "import json;print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
curl -s "https://api.vercel.com/v6/deployments?projectId=sotong-dev-per&teamId=team_CQk1P1EUWRUliyEBshEp7rRU&limit=5" \
  -H "Authorization: Bearer $TOK" |
  python3 -c "import json,sys;[print(x.get('target'), (x.get('meta') or {}).get('githubCommitSha','—')[:7], (x.get('meta') or {}).get('githubCommitRef','—'), x.get('source') or 'cli') for x in json.load(sys.stdin)['deployments']]"
```

`src=git` 이면 정상 경로, `src=cli` 면 그 시점부터 `main` 과 갈라져 있다는 뜻이다.

## 시크릿

`SOTONG_ENTRY_SECRET` · `SOTONG_ADMIN_TOKEN` 은 Vercel 에서 **Sensitive** 라
`vercel env pull` 로 **안 내려온다.** 로컬 `.env.local` 에도 없다.

- 🔴 **`SOTONG_ENTRY_SECRET` 은 회전 금지 + 복구 불가.** 회전하면 인쇄된 QR·발송된
  진입 링크가 전부 죽는다. 그리고 읽을 수 없으므로 **백업이 어디에도 없다** —
  Vercel 에서 지워지면 되살릴 방법이 없다. QR 은 앱이 만드니(오너 콘솔 QR 탭) 값을
  알 필요는 없지만, **그 var 를 건드리지 말 것**
- `SOTONG_ADMIN_TOKEN` 은 회전해도 기존 어드민 세션 쿠키만 끊긴다(쿠키가 토큰 파생
  HMAC 마커라서). 값을 알아야 하면 새로 넣으면 된다
