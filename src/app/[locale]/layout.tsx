import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/toast";
import "../globals.css";

export const metadata: Metadata = {
  title: "소통 · Sotong",
  description:
    "외국인 손님을 위한 다국어 AI 상담·접수 데스크. 손님은 자기 언어로 탭하고, 디자이너는 한국어 요약을 받는다.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "소통",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // 핀치 줌 허용 (WCAG 1.4.4) — maximumScale/userScalable 강제 금지
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // URL 의 [locale] 을 이 렌더의 요청 로케일로 확정 + 클라이언트 provider 에 명시 전달.
  // (이게 없으면 클라이언트 컴포넌트의 useTranslations 가 기본 로케일 ko 로 폴백한다.)
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
