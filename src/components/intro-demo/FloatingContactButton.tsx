"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import ContactSheet from "@/components/intro-demo/ContactSheet";

/**
 * 페이지 어디를 스크롤해도 우하단에 떠 있는 원형 문의 버튼(챗봇 버블 형태).
 * 누르면 인라인 CTA와 동일한 선택창(ContactSheet)이 열린다.
 * IntroDemoFunnel 루트에 한 번만 마운트한다.
 */
export default function FloatingContactButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="우리 매장에 도입 문의하기"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-500 py-3.5 pl-5 pr-5 text-sm font-semibold text-white shadow-xl shadow-brand-500/30 transition-all hover:-translate-y-0.5 hover:bg-brand-400 sm:bottom-7 sm:right-7"
      >
        {/* 은은한 주목 링(펄스) */}
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-500/40 [animation-duration:2.4s]" />
        <MessagesSquare size={22} className="shrink-0" />
        <span className="whitespace-nowrap">도입 문의하기</span>
      </button>
      <ContactSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
