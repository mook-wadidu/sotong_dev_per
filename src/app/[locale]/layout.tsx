import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/toast";
import "../globals.css";

// 링크 프리뷰(손님이 리포트 URL 을 LINE/WeChat 등에 공유) 는 유일한 외부노출면 →
// 한국어 고정이면 비한국어 수신자에게 한국어 블러브가 뜬다. 로케일별로 지역화(M).
const META: Record<string, { description: string; ogLocale: string }> = {
  ko: {
    description:
      "외국인 손님을 위한 다국어 AI 상담·접수 데스크. 손님은 자기 언어로, 디자이너는 한국어 요약을 받는다.",
    ogLocale: "ko_KR",
  },
  ja: {
    description:
      "自分の言語でサロン相談、施術後は多言語のヘアレポート。外国人のお客様のための多言語AIカウンセリング。",
    ogLocale: "ja_JP",
  },
  en: {
    description:
      "Multilingual salon consultation and an after-service hair report in your own language.",
    ogLocale: "en_US",
  },
  zh: {
    description:
      "用你的语言进行沙龙咨询，护理后获得多语言头发报告。为外国顾客打造的多语言 AI 咨询台。",
    ogLocale: "zh_CN",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.ko;
  const title = "소통 · Sotong";
  return {
    title,
    description: m.description,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "소통", statusBarStyle: "default" },
    icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
    openGraph: {
      title,
      description: m.description,
      type: "website",
      locale: m.ogLocale,
    },
  };
}

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
