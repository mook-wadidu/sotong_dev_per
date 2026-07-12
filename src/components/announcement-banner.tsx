import { getActiveAnnouncements } from "@/lib/service";
import type { AnnouncementAudience } from "@/lib/db/types";

/**
 * 공지 배너(서버 컴포넌트) — 대상/살롱/로케일에 맞는 활성 공지를 상단에 노출.
 * 활성 공지가 없으면 아무것도 렌더하지 않음(레이아웃 무변). 흑백.
 */
export async function AnnouncementBanner({
  audiences,
  salonSlug,
  locale,
}: {
  audiences: AnnouncementAudience[];
  salonSlug?: string;
  locale: string;
}) {
  const items = await getActiveAnnouncements({ audiences, salonSlug, locale });
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div
          key={a.id}
          role="status"
          className="rounded-xl border border-foreground/20 bg-muted/40 px-4 py-3"
        >
          {a.title ? (
            <p className="text-sm font-semibold leading-tight text-foreground">
              {a.title}
            </p>
          ) : null}
          {a.body ? (
            <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {a.body}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
