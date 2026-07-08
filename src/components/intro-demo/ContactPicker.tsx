"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

/** 연락처 상수 — 전화/문자는 같은 번호, 메일은 대표 주소 */
const CONTACT = {
  tel: "01076636017",
  email: "mook@wadidu.com",
} as const;

type Channel = "mail" | "call" | "sms";

/** 각 채널이 실제로 여는 링크 (iOS·Android 모두 기본 앱을 띄운다) */
const CHANNEL_HREF: Record<Channel, string> = {
  mail: `mailto:${CONTACT.email}`,
  call: `tel:${CONTACT.tel}`,
  sms: `sms:${CONTACT.tel}`,
};

/** 채널별 SVG 아이콘 — 선택창에 쓰이는 이미지 */
function ChannelIcon({ channel }: { channel: Channel }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (channel === "mail") {
    return (
      <svg {...common}>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
        <path d="m3 6 9 6.5L21 6" />
      </svg>
    );
  }
  if (channel === "call") {
    return (
      <svg {...common}>
        <path d="M4.5 3.5h3.2l1.5 4-2 1.4a12.5 12.5 0 0 0 5.4 5.4l1.4-2 4 1.5v3.2a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 2.5 5.7a2 2 0 0 1 2-2.2Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 3.5V16.5H4A1.5 1.5 0 0 1 2.5 15V6A1.5 1.5 0 0 1 4 4.5Z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  );
}

const OPTIONS: { channel: Channel; label: string; sub: string }[] = [
  { channel: "mail", label: "메일", sub: CONTACT.email },
  { channel: "call", label: "전화", sub: "010-7663-6017" },
  { channel: "sms", label: "문자", sub: "010-7663-6017" },
];

type Props = {
  /** 버튼에 표시할 문구 (기존 finalCta.label) */
  label: string;
  className?: string;
};

/**
 * 도입 문의 CTA. 눌러도 외부 페이지로 바로 이동하지 않고
 * 메일·전화·문자 중 하나를 고르는 선택창(바텀시트)을 띄운다.
 * 선택 시 해당 기본 앱(메일/전화/메시지)이 실행된다.
 */
export default function ContactPicker({ label, className }: Props) {
  const [open, setOpen] = useState(false);

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
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
        <ArrowRight size={18} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="문의 방법 선택"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setOpen(false)}
        >
          {/* 딤 배경 */}
          <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />

          {/* 시트 */}
          <div
            className="animate-sheet-in relative w-full max-w-md rounded-t-[1.75rem] bg-white p-6 pb-8 text-left shadow-2xl sm:rounded-[1.75rem] sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink-900">
                  어떻게 문의할까요?
                </h3>
                <p className="mt-1 text-sm text-ink-400">
                  편한 방법을 선택하면 바로 연결됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="-mr-1 -mt-1 rounded-full p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-3">
              {OPTIONS.map((o) => (
                <a
                  key={o.channel}
                  href={CHANNEL_HREF[o.channel]}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50/60"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <ChannelIcon channel={o.channel} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-900">
                      {o.label}
                    </span>
                    <span className="block truncate text-sm text-ink-400">
                      {o.sub}
                    </span>
                  </span>
                  <ArrowRight
                    size={18}
                    className="ml-auto shrink-0 text-ink-300"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
