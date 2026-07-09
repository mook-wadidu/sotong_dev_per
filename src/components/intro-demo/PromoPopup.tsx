"use client";

import { useEffect, useState } from "react";
import { Gift, X, ArrowRight } from "lucide-react";
import { CONTACT } from "@/components/intro-demo/ContactSheet";

/** "무료로 신청하기" → 이벤트 신청 제목·본문이 채워진 메일 작성 링크 */
const SIGNUP_MAILTO = `mailto:${CONTACT.email}?subject=${encodeURIComponent(
  "소통 1년 무료 이벤트 신청",
)}&body=${encodeURIComponent(
  "소통 도입을 신청합니다. (7월 한정 1년 무료 이벤트)\n\n" +
    "· 매장명:\n" +
    "· 담당자 성함:\n" +
    "· 연락처:\n" +
    "· 지역:\n\n" +
    "확인 후 연락 부탁드립니다.",
)}`;

/**
 * 진입 시 1회 뜨는 홍보 팝업 — 7월 한정 "1년 무료" 이벤트 안내.
 * 인트로 시퀀스(IntroSequence)가 끝난 뒤 뜨도록, 인트로 완료 플래그를 기다린다.
 * 같은 세션에서 이미 봤으면 다시 뜨지 않는다(재방문 시 다시 노출).
 */
const PROMO_SEEN_KEY = "sotong_promo_seen_2607";
const INTRO_SEEN_KEY = "sotong_intro_seen";

export default function PromoPopup() {
  const [open, setOpen] = useState(false);

  // 세션당 1회, 인트로가 끝난 뒤 노출
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PROMO_SEEN_KEY)) return;
    } catch {
      // sessionStorage 불가(프라이빗 모드 등) — 그냥 노출 진행
    }

    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      setOpen(true);
      try {
        sessionStorage.setItem(PROMO_SEEN_KEY, "1");
      } catch {
        // 무시
      }
    };

    const introSeen = () => {
      try {
        return !!localStorage.getItem(INTRO_SEEN_KEY);
      } catch {
        return true; // 확인 불가면 인트로 대기 없이 진행
      }
    };

    // 인트로를 이미 봤으면 잠깐 뒤 노출, 아니면 인트로 완료를 폴링으로 기다린다.
    if (introSeen()) {
      const t = setTimeout(show, 700);
      return () => clearTimeout(t);
    }
    const poll = setInterval(() => {
      if (introSeen()) {
        clearInterval(poll);
        setTimeout(show, 700);
      }
    }, 400);
    // 인트로가 예상보다 길거나 감지 실패 시 안전장치(최대 12초 후 노출)
    const fallback = setTimeout(() => {
      clearInterval(poll);
      show();
    }, 12000);
    return () => {
      clearInterval(poll);
      clearTimeout(fallback);
    };
  }, []);

  // 열려 있는 동안 배경 스크롤 잠금 + ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="promo-title"
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
          onClick={() => setOpen(false)}
        >
          {/* 딤 배경 */}
          <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />

          {/* 카드 */}
          <div
            className="animate-sheet-in relative w-full max-w-md overflow-hidden rounded-t-[1.75rem] bg-white text-left shadow-2xl sm:rounded-[1.75rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="absolute right-3.5 top-3.5 z-10 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X size={20} />
            </button>

            {/* 축하 그라데이션 헤더 */}
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-500 to-accent px-7 pb-8 pt-9 text-center text-white">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-12 -left-6 size-36 rounded-full bg-white/10 blur-2xl"
              />
              <span className="relative mx-auto mb-4 grid size-16 place-items-center rounded-full bg-white/20 ring-1 ring-white/30">
                <Gift size={30} />
              </span>
              <span className="relative inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold tracking-wide ring-1 ring-white/25">
                🎉 7월 한정 오픈 이벤트
              </span>
              <h2
                id="promo-title"
                className="relative mt-3 text-2xl font-extrabold leading-tight"
              >
                지금 신청하면
                <br />
                <span className="text-3xl">1년 무료</span>
              </h2>
            </div>

            {/* 본문 */}
            <div className="px-7 pb-7 pt-6">
              <p className="text-center text-[15px] leading-relaxed text-ink-700">
                7월 한 달 동안 도입을 신청하시면
                <br />
                <b className="font-bold text-ink-900">
                  내년 6월까지 소통을 1년 내내 무료
                </b>
                로 이용하실 수 있어요.
              </p>
              <p className="mt-3 text-center text-xs text-ink-400">
                이 혜택은 2026년 7월 신청분에 한해 제공됩니다.
              </p>

              <a
                href={SIGNUP_MAILTO}
                onClick={() => setOpen(false)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-400"
              >
                무료로 신청하기
                <ArrowRight size={18} />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-2 w-full rounded-full py-2.5 text-sm font-medium text-ink-400 transition-colors hover:text-ink-700"
              >
                나중에 볼게요
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
