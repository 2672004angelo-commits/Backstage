"use client";

import { useState, type FormEvent } from "react";
import { formatPerformanceTime, getShowPerformances } from "@/lib/show-performances";

type Performance = ReturnType<typeof getShowPerformances>[number];

const bookingErrors: Record<string, string> = {
  DATABASE_NOT_CONFIGURED: "خدمة الحجز غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.",
  SHOW_UNAVAILABLE: "هذا العرض غير متاح للحجز حاليًا.",
  PERFORMANCE_REQUIRED: "اختر ليلة العرض قبل تأكيد الحجز.",
  PERFORMANCE_UNAVAILABLE: "ليلة العرض المختارة لم تعد متاحة. حدّث الصفحة واختر موعدًا آخر.",
  BOOKING_ALREADY_EXISTS: "لديك حجز مسجل لهذه الليلة بالفعل. راجع صفحة «حجوزاتي» أو ارفع إثبات الدفع للحجز السابق.",
  NOT_ENOUGH_CAPACITY: "اكتمل عدد المقاعد المتاحة لهذه الليلة. اختر ليلة أخرى إن توفرت.",
  PUSH_CONSENT_REQUIRED: "وافق على إشعارات اعتماد التذكرة لإتمام الحجز.",
  PUSH_NOT_CONFIGURED: "خدمة الإشعارات غير مهيأة حاليًا. لم يتم إنشاء الحجز.",
  PUSH_SUBSCRIPTION_REQUIRED: "فعّل إشعارات اعتماد التذكرة لإتمام الحجز.",
  PUSH_SUBSCRIPTION_FAILED: "تعذر حفظ تفعيل الإشعارات، ولم يكتمل الحجز. حاول مرة أخرى.",
};

const pushErrors: Record<string, string> = {
  PUSH_UNSUPPORTED: "الإشعارات غير مدعومة على هذا المتصفح، لذلك لا يمكن إتمام الحجز منه.",
  PUSH_NOT_CONFIGURED: "خدمة الإشعارات غير مهيأة حاليًا. لم يتم إنشاء الحجز.",
  PUSH_PERMISSION_DENIED: "الإشعارات محظورة لهذا الموقع. اسمح بها من إعدادات المتصفح ثم حاول مجددًا.",
  PUSH_PERMISSION_REQUIRED: "يجب السماح بالإشعارات لإتمام الحجز.",
  PUSH_SUBSCRIBE_FAILED: "تعذر تفعيل الإشعارات على هذا الجهاز. تحقق من اتصالك وحاول مرة أخرى.",
};

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return bookingErrors[error] || "";
  if (!error || typeof error !== "object") return "";
  const fieldErrors = "fieldErrors" in error && error.fieldErrors
    ? error.fieldErrors as Record<string, unknown>
    : {};
  if (Array.isArray(fieldErrors.fullName) || Array.isArray(fieldErrors.mobile)) {
    return "أدخل الاسم الرباعي ورقم هاتف صحيحًا ثم حاول مرة أخرى.";
  }
  if (Array.isArray(fieldErrors.performanceId)) return bookingErrors.PERFORMANCE_REQUIRED;
  return "";
}

function normalizeMobile(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[\s()-]/g, "");
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function createPushSubscription() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("PUSH_UNSUPPORTED");
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("PUSH_NOT_CONFIGURED");
  if (Notification.permission === "denied") throw new Error("PUSH_PERMISSION_DENIED");

  const permissionRequest = Notification.permission === "granted"
    ? Promise.resolve<NotificationPermission>("granted")
    : Notification.requestPermission();
  const permission = await permissionRequest;
  if (permission !== "granted") throw new Error("PUSH_PERMISSION_REQUIRED");

  try {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    return subscription.toJSON();
  } catch {
    throw new Error("PUSH_SUBSCRIBE_FAILED");
  }
}

export default function BookingForm({
  showId,
  performances,
  selectedId,
  demoMode = false,
}: {
  showId: string;
  performances: Performance[];
  selectedId: string;
  demoMode?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (demoMode) return;
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      showId,
      performanceId: String(formData.get("performanceId") || ""),
      fullName: String(formData.get("fullName") || "").trim(),
      mobile: normalizeMobile(String(formData.get("mobile") || "")),
      email: String(formData.get("email") || "").trim(),
      quantity: 1,
      notificationConsent: formData.get("notificationConsent") === "on",
    };

    try {
      const pushSubscription = await createPushSubscription();
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, pushSubscription }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const apiError = data && typeof data === "object" && "error" in data
          ? data.error
          : "";
        setError(getErrorMessage(apiError) || "تعذر تأكيد الحجز. تحقق من البيانات وحاول مرة أخرى.");
        return;
      }
      if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
        throw new Error("INVALID_BOOKING_RESPONSE");
      }
      window.location.assign(`/payment/${encodeURIComponent(data.id)}`);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message in pushErrors) {
        setError(pushErrors[requestError.message]);
        return;
      }
      console.error("BOOKING_REQUEST_FAILED", requestError instanceof Error ? requestError.name : "UnknownError");
      setError("تعذر الاتصال بخدمة الحجز. تحقق من اتصال الإنترنت وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="card public-booking-form"
      action={demoMode ? `/payment/${encodeURIComponent(showId)}` : "/api/bookings"}
      method="get"
      onSubmit={submit}
    >
      {!demoMode && <input type="hidden" name="showId" value={showId} />}
      <input type="hidden" name="quantity" value="1" />
      <label className="public-booking-field">
        اختر ليلة العرض
        <select className="field" name="performanceId" required defaultValue={selectedId}>
          <option value="" disabled>حدد التاريخ والوقت</option>
          {performances.map((performance, index) => (
            <option key={performance.id} value={performance.id} disabled={!performance.open}>
              {`الليلة ${index + 1} — ${performance.date}، ${formatPerformanceTime(performance.time)}${performance.open ? "" : " (الحجز مغلق)"}`}
            </option>
          ))}
        </select>
      </label>
      <label className="public-booking-field">
        الاسم رباعيًا (مطلوب)
        <input
          className="field"
          name="fullName"
          required
          minLength={7}
          pattern=".*\S+\s+\S+\s+\S+\s+\S+.*"
          title="أدخل الاسم الرباعي كما يظهر في البطاقة"
          placeholder="محمد أحمد علي حسن"
        />
      </label>
      <label className="public-booking-field">
        رقم الهاتف
        <input
          className="field"
          name="mobile"
          type="tel"
          inputMode="tel"
          required
          pattern="[+]?[0-9٠-٩۰-۹ ()-]{8,20}"
          title="أدخل رقم هاتف صحيحًا"
          placeholder="0770 123 4567"
          defaultValue={demoMode ? "07701234567" : undefined}
        />
      </label>
      <label className="public-booking-field">
        البريد الإلكتروني (اختياري)
        <input className="field" name="email" type="email" />
      </label>
      <p className="public-booking-note">
        تذكرة واحدة لكل رقم هاتف أو بريد إلكتروني في الليلة الواحدة. يمكن الحجز لليالي أخرى كلٌّ على حدة.
      </p>
      {!demoMode && (
        <label className="public-booking-notification">
          <input type="checkbox" name="notificationConsent" required />
          <span>أوافق على تفعيل إشعارات الهاتف لإبلاغي عند اعتماد التذكرة (مطلوب لإتمام الحجز).</span>
        </label>
      )}
      <button className="btn" type="submit" disabled={loading || performances.every((performance) => !performance.open)}>
        {loading ? "جارٍ تفعيل الإشعارات وتأكيد الحجز..." : demoMode ? "متابعة للدفع التجريبي" : "تأكيد الحجز والدفع"}
      </button>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </form>
  );
}
