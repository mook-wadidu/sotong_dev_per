import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Noto_Serif_KR } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/toast";
import "../globals.css";

/**
 * 폰트 셀프호스팅 — 과거 globals.css 가 jsDelivr(Pretendard)·Google Fonts(Noto Serif KR)를
 * @import 해서, **동의 전 모든 방문자의 IP·UA 가 국외 CDN 으로 전송**됐다(손님이 EU/JP/CN
 * 관광객이라 GDPR 노출: Google Fonts IP 전송 판례군). next/font 는 빌드 시 자체 도메인으로
 * 자산을 내재화해 **브라우저가 외부에 요청하지 않는다**.
 */
const pretendard = localFont({
  src: "../fonts/PretendardVariable.woff2",
  weight: "45 920", // 가변 폰트 축(원본 CSS 와 동일)
  style: "normal",
  display: "swap",
  variable: "--font-pretendard",
  preload: true,
});

// 브랜드 워드마크 전용(intro-demo). next/font/google 은 빌드 시 자체 호스팅 → 구글 요청 0.
const notoSerifKr = Noto_Serif_KR({
  // next/font 타입상 이 폰트는 "korean" 서브셋을 받지 않는다(latin/latin-ext/cyrillic/vietnamese).
  // 구글이 한글을 unicode-range 청크로 쪼개 주고 Next 가 그 청크 전부를 셀프호스팅하므로,
  // latin 으로 두어도 워드마크("소통") 글리프가 포함되며 브라우저는 해당 청크만 내려받는다.
  subsets: ["latin"],
  // 실사용 굵기만: Nav/Footer 는 기본(400), IntroSequence 는 font-light(300). 500/700/900 미사용.
  weight: ["300", "400"],
  display: "swap",
  variable: "--font-noto-serif-kr",
  preload: false, // /demo 워드마크 전용 — 초기 로드에 불필요(필요할 때만 지연 로드)
});

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
    <html
      lang={locale}
      className={`h-full antialiased ${pretendard.variable} ${notoSerifKr.variable}`}
    >
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
