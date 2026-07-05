"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import Container from "./Container";
import { brand, nav } from "@/content/intro-demo";
import { cn } from "@/lib/utils";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-ink-900">
      <Image
        src="/logo.png"
        alt={`${brand.name} 로고`}
        width={36}
        height={36}
        className="h-9 w-9 object-contain"
        priority
        unoptimized
      />
      <span className="text-lg tracking-tight">
        <span className="font-serif">{brand.name}</span>
        <span className="ml-1 text-sm font-medium text-ink-400">
          {brand.nameEn}
        </span>
      </span>
    </Link>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-ink-900/5 bg-white/80 backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {nav.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-700 transition-colors hover:text-brand-600"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href={nav.cta.href}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-600 hover:-translate-y-0.5"
          >
            {nav.cta.label}
          </Link>
        </nav>

        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg text-ink-700 md:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </Container>

      {open && (
        <div className="border-t border-ink-900/5 bg-white md:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {nav.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-ink-700 hover:bg-brand-50"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={nav.cta.href}
              onClick={() => setOpen(false)}
              className="mt-1 rounded-full bg-brand-500 px-4 py-3 text-center text-base font-semibold text-white"
            >
              {nav.cta.label}
            </Link>
          </Container>
        </div>
      )}
    </header>
  );
}
