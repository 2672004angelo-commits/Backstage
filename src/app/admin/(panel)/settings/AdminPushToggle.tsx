"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export default function AdminPushToggle() {
  const [state, setState] = useState<"loading" | "unsupported" | "unconfigured" | "off" | "on" | "denied">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState("unconfigured");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    let cancelled = false;
    navigator.serviceWorker.register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => { if (!cancelled) setState(subscription ? "on" : "off"); })
      .catch(() => { if (!cancelled) setState("unsupported"); });
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") { setState(Notification.permission === "denied" ? "denied" : "off"); return; }
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const response = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error("SUBSCRIBE_API_FAILED");
      setState("on");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/admin/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card admin-form-card">
      <h2>إشعارات الحجوزات</h2>
      <p className="admin-hint">فعّل الإشعارات ليصلك تنبيه فوري على هذا الجهاز عند كل حجز جديد.</p>
      {state === "loading" && <p className="admin-hint">جارٍ فحص الإشعارات…</p>}
      {state === "unsupported" && <p className="admin-hint">المتصفح لا يدعم إشعارات الويب.</p>}
      {state === "unconfigured" && <p className="admin-hint">الإشعارات غير مهيأة على الخادم بعد (مفاتيح VAPID).</p>}
      {state === "denied" && <p className="admin-hint">إذن الإشعارات مرفوض من المتصفح. اسمح به من إعدادات المتصفح ثم أعد المحاولة.</p>}
      {state === "on" && (
        <button type="button" className="btn" onClick={disable} disabled={busy}>
          {busy ? "جارٍ الإيقاف…" : "إيقاف الإشعارات على هذا الجهاز"}
        </button>
      )}
      {state === "off" && (
        <button type="button" className="btn" onClick={enable} disabled={busy}>
          {busy ? "جارٍ التفعيل…" : "تفعيل إشعارات الحجوزات الجديدة"}
        </button>
      )}
    </section>
  );
}
