"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import ContactSheet from "@/components/intro-demo/ContactSheet";

type Props = {
  /** 버튼에 표시할 문구 (기존 finalCta.label) */
  label: string;
  className?: string;
};

/**
 * 도입 문의 인라인 CTA. 눌러도 외부 페이지로 바로 이동하지 않고
 * 메일·전화·문자 선택창(ContactSheet)을 띄운다.
 */
export default function ContactPicker({ label, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
        <ArrowRight size={18} />
      </button>
      <ContactSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
