"use client";

import { useEffect, useState, type FormEvent } from "react";

type SearchResult = {
  status: string;
  show: string;
  performanceDate?: string;
  performanceTime?: string;
  quantity: number;
  rejectionReason?: string;
  tickets: { ticketId: string; imageUrl: string }[];
};
type SearchCredentials = { bookingId: string; mobile: string; email: string };

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return typeof result.status === "string"
    && typeof result.show === "string"
    && typeof result.quantity === "number"
    && (result.performanceDate === undefined || typeof result.performanceDate === "string")
    && (result.performanceTime === undefined || typeof result.performanceTime === "string")
    && Array.isArray(result.tickets)
    && result.tickets.every((ticket) => ticket && typeof ticket.ticketId === "string" && typeof ticket.imageUrl === "string");
}

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "بانتظار رفع إثبات الدفع",
  PENDING_REVIEW: "إثبات الدفع قيد المراجعة",
  REJECTED: "تم رفض إثبات الدفع",
  APPROVED: "تم اعتماد الدفع، تذكرتك جاهزة",
};

export default function BookingSearch() {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [credentials, setCredentials] = useState<SearchCredentials | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  async function enableNotifications() {
    if (!credentials || !("Notification" in window) || !("serviceWorker" in navigator) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setPushStatus("الإشعارات غير مدعومة على هذا المتصفح أو لم يتم تهيئة مفاتيح الإشعار.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("لم يتم السماح بالإشعارات.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        });
      }
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...credentials, subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error("PUSH_SUBSCRIBE_FAILED");
      setPushStatus("تم تفعيل إشعارات الهاتف لحالة الحجز.");
    } catch {
      setPushStatus("تعذر تفعيل الإشعارات على هذا الجهاز.");
    }
  }

  useEffect(() => {
    if (!credentials || result?.status !== "PENDING_REVIEW") return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/bookings/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(credentials),
        });
        if (!response.ok) throw new Error(`BOOKING_STATUS_${response.status}`);
        const data: unknown = await response.json();
        if (!isSearchResult(data)) throw new Error("INVALID_BOOKING_STATUS");
        if (active && data.status !== "PENDING_REVIEW") {
          setResult(data);
          setError("");
        }
      } catch {
        if (active) setError("تعذر تحديث حالة الحجز تلقائيًا. يمكنك إعادة البحث يدويًا.");
      }
    }, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [credentials, result?.status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const searchCredentials = {
        bookingId: String(form.get("bookingId") || "").trim(),
        mobile: String(form.get("mobile") || "").trim(),
        email: String(form.get("email") || "").trim(),
      };
      const response = await fetch("/api/bookings/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(searchCredentials),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(response.status === 404 ? "لم نعثر على الحجز بهذه البيانات." : `تعذر البحث عن الحجز (${response.status}).`);
        return;
      }
      if (!isSearchResult(data)) throw new Error("INVALID_BOOKING_STATUS");
      setCredentials(searchCredentials);
      setResult(data);
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="card booking-search-form">
        <p>أدخل رقم الحجز الظاهر في رابط الدفع ورقم الهاتف المستخدم عند الحجز. إذا أضفت بريدًا إلكترونيًا، أدخله أيضًا.</p>
        <input className="field" name="bookingId" placeholder="رقم الحجز" required />
        <input className="field" name="mobile" type="tel" placeholder="رقم الهاتف" required />
        <input className="field" name="email" type="email" placeholder="البريد الإلكتروني (إن أُضيف للحجز)" />
        <button className="btn" type="submit" disabled={loading}>{loading ? "جارٍ البحث..." : "عرض حالة الحجز"}</button>
      </form>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
      {result && (
        <section className="card booking-search-result" aria-live="polite">
          <p>العرض: <strong>{result.show}</strong></p>
          {(result.performanceDate || result.performanceTime) && (
            <p>موعد العرض: <strong>{result.performanceDate} {result.performanceTime}</strong></p>
          )}
          <p>الحالة: <strong>{statusLabels[result.status] || result.status}</strong></p>
          {result.rejectionReason && <p>سبب الرفض: {result.rejectionReason}</p>}
          {credentials && (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <button className="btn" type="button" onClick={() => void enableNotifications()}>
                تفعيل إشعارات الهاتف عند اعتماد الحجز
              </button>
              {pushStatus && <p className="admin-form-status" role="status">{pushStatus}</p>}
            </div>
          )}
          {result.status === "PENDING_REVIEW" && <p>ستتحدث الحالة تلقائيًا أثناء بقاء هذه الصفحة مفتوحة.</p>}
          {result.status === "APPROVED" && result.tickets.length > 0 && (
            <div className="booking-ready-tickets">
              <h2>تذكرتك جاهزة</h2>
              <p>احفظ صورة التذكرة على هاتفك وقدمها عند باب العرض.</p>
              {result.tickets.map((ticket) => (
                <article className="booking-ready-ticket" key={ticket.ticketId}>
                  <strong>{ticket.ticketId}</strong>
                  <a href={ticket.imageUrl} target="_blank" rel="noreferrer" download>
                    <img src={ticket.imageUrl} alt={`التذكرة ${ticket.ticketId}`} referrerPolicy="no-referrer" />
                  </a>
                  <a href={ticket.imageUrl} download>تنزيل التذكرة</a>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
