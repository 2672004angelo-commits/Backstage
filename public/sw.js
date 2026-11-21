self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "BACKSTAGE", body: "تم تحديث حالة حجزك" };
  }
  const title = payload.title || "BACKSTAGE";
  const options = {
    body: payload.body || "تم تحديث حالة حجزك",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: payload.url || "/bookings" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/bookings";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
