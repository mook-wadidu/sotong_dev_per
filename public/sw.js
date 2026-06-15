/* 소통 디자이너 PWA 서비스워커 — 웹푸시 수신 + 클릭 시 인박스 열기 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "소통";
  const options = {
    body: data.body || "새 손님이 접수했어요",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    lang: "ko",
    tag: data.tag || "sotong-inquiry",
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/ko" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/ko";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.includes(url) && "focus" in w) return w.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
