import Link from "next/link";
import Image from "next/image";
import Container from "./Container";
import { brand, footer, nav } from "@/content/intro-demo";

export default function Footer() {
  return (
    <footer className="border-t border-ink-900/5 bg-brand-50/40">
      <Container className="flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-bold text-ink-900">
            <Image
              src="/logo.png"
              alt={`${brand.name} 로고`}
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              unoptimized
            />
            <span>
              <span className="font-serif">{brand.name}</span>
              <span className="ml-1 text-sm font-medium text-ink-400">
                {brand.nameEn}
              </span>
            </span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-ink-500">{footer.note}</p>
        </div>

        <div className="flex flex-col gap-3">
          <nav className="flex gap-6">
            {nav.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-ink-500 hover:text-brand-600"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-ink-400">{footer.copyright}</p>
        </div>
      </Container>
    </footer>
  );
}
