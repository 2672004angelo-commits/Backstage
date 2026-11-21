"use client";

import { useState, type FormEvent } from "react";

export default function PaymentUploadForm({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [reminderStatus, setReminderStatus] = useState("");
  const [reminderLoading, setReminderLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/payments", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(String(data?.error || `PAYMENT_UPLOAD_FAILED_${response.status}`));
      }
      setShowReminderPrompt(true);
    } catch (uploadError) {
      setError(uploadError instanceof Error
        ? "تعذر رفع إثبات التحويل. تأكد من الصورة وحدودها وحاول مرة أخرى."
        : "تعذر رفع إثبات التحويل.");
    } finally {
      setLoading(false);
    }
  }

  async function enableReminder() {
    if (reminderLoading) return;
    setReminderLoading(true);
    setReminderStatus("");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setReminderStatus("الإشعارات غير مدعومة على هذا المتصفح.");
        return;
      }
      const permissionRequest = Notification.requestPermission();
      const registration = await navigator.serviceWorker.register("/sw.js");
      const activeRegistration = await navigator.serviceWorker.ready;
      const permission = await permissionRequest;
      if (permission !== "granted") {
        setReminderStatus("يمكنك تفعيل الإشعارات لاحقًا من إعدادات المتصفح.");
        return;
      }
      const pushManager = activeRegistration.pushManager || registration.pushManager;
      let subscription = await pushManager.getSubscription();
      if (!subscription) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) throw new Error("VAPID_NOT_CONFIGURED");
        const padding = "=".repeat((4 - publicKey.length % 4) % 4);
        const raw = window.atob((publicKey + padding).replace(/-/g, "+").replace(/_/g, "/"));
        subscription = await pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(raw, (character) => character.charCodeAt(0)),
        });
      }
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId, subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error("SUBSCRIBE_FAILED");
      setReminderStatus("تم تفعيل الرسالة التذكيرية لحين تجهيز التذكرة.");
    } catch {
      setReminderStatus("تعذر تفعيل الإشعارات الآن، يمكنك المحاولة من صفحة حجوزاتي.");
    } finally {
      setReminderLoading(false);
    }
  }

  function continueToBookingStatus() {
    window.location.replace(`/payment/${encodeURIComponent(bookingId)}?submitted=1`);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <label>طريقة التحويل
        <select className="field" name="paymentMethod" required>
          <option value="" disabled selected>اختر Instapay أو محفظة كاش</option>
          <option value="INSTAPAY">Instapay</option>
          <option value="CASH_WALLET">محفظة كاش</option>
        </select>
      </label>
      <label>صورة إثبات التحويل (JPEG أو PNG أو WebP، حتى 8 ميجابايت)
        <input className="field" type="file" name="screenshot" accept="image/jpeg,image/png,image/webp" required />
      </label>
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "جارٍ رفع إثبات التحويل..." : "رفع إثبات الدفع"}
      </button>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
      {showReminderPrompt && (
        <section className="booking-reminder-modal" aria-labelledby="booking-reminder-title">
          <strong id="booking-reminder-title">عزيزنا، هل تريد رسالة تذكير عند تجهيز تذكرتك؟</strong>
          <p>شكراً لزيارتك BACKSTAGE. سنخبرك فور اعتماد الحجز وتجهيز التذكرة.</p>
          <div>
            <button className="btn" type="button" onClick={() => void enableReminder()} disabled={reminderLoading || Boolean(reminderStatus)}>
              {reminderLoading ? "جارٍ تفعيل الإشعارات..." : "نعم، فعّل الرسالة"}
            </button>
            {!reminderStatus && <button className="btn booking-reminder-later" type="button" onClick={continueToBookingStatus}>
              ليس الآن
            </button>}
          </div>
          {reminderStatus && <p className="admin-form-status" role="status">{reminderStatus}</p>}
          {reminderStatus && <button className="btn booking-reminder-later" type="button" onClick={continueToBookingStatus}>متابعة إلى حالة الحجز</button>}
        </section>
      )}
    </form>
  );
}
