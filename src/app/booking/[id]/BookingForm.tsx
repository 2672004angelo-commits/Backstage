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
  PROOF_REQUIRED: "صورة إثبات الدفع مطلوبة لإتمام الحجز. حوّل المبلغ ثم ارفع صورة التحويل مع الحجز.",
  INVALID_PAYMENT_METHOD: "اختر طريقة التحويل التي استخدمتها: Instapay أو محفظة كاش.",
  INVALID_FILE: "صورة إثبات الدفع غير مقبولة. ارفع صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 8 ميجابايت.",
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
  if (
    !("Notification" in window)
    || !("serviceWorker" in navigator)
    || !("PushManager" in window)
  ) {
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
    formData.set("showId", showId);
    formData.set("fullName", String(formData.get("fullName") || "").trim());
    formData.set("mobile", normalizeMobile(String(formData.get("mobile") || "")));
    formData.set("email", String(formData.get("email") || "").trim());
    formData.set("quantity", "1");

    try {
      let pushSubscription: Awaited<ReturnType<typeof createPushSubscription>> | null = null;
      if (formData.get("notificationConsent") === "on") {
        try {
          pushSubscription = await createPushSubscription();
        } catch (pushError) {
          console.info(
            "BOOKING_PUSH_OPTIONAL_UNAVAILABLE",
            pushError instanceof Error ? pushError.message : "UnknownError",
          );
        }
      }
      if (pushSubscription) formData.set("pushSubscription", JSON.stringify(pushSubscription));
      const response = await fetch("/api/bookings", {
        method: "POST",
        body: formData,
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
      window.location.assign(`/payment/${encodeURIComponent(data.id)}?submitted=1`);
    } catch (requestError) {
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
          title="أدخل رقم هاتف صحيحًا"
          placeholder="010 1234 5678"
          defaultValue={demoMode ? "01012345678" : undefined}
        />
      </label>
      <label className="public-booking-field">
        البريد الإلكتروني (ستحتاجه مع رقم هاتفك لمتابعة الحجز)
        <input className="field" name="email" type="email" required />
      </label>
      <section className="payment-instructions" aria-label="تعليمات الدفع">
        <p>حوّل المبلغ إلى أحد الرقمين التاليين، ثم ارفع صورة واضحة لإثبات الدفع مع الحجز:</p>
        <div className="payment-instructions-grid">
          <div className="payment-instructions-account">
            <span>Instapay</span>
            <strong dir="ltr">01273176278</strong>
          </div>
          <div className="payment-instructions-account">
            <span>محفظة كاش</span>
            <strong dir="ltr">01229212293</strong>
          </div>
        </div>
      </section>
      {!demoMode && (
        <>
          <label className="public-booking-field">
            طريقة التحويل (مطلوبة)
            <select className="field" name="paymentMethod" required defaultValue="">
              <option value="" disabled>اختر Instapay أو محفظة كاش</option>
              <option value="INSTAPAY">Instapay</option>
              <option value="CASH_WALLET">محفظة كاش</option>
            </select>
          </label>
          <label className="public-booking-field">
            صورة إثبات التحويل (مطلوبة — JPEG أو PNG أو WebP، حتى 8 ميجابايت)
            <input className="field" type="file" name="screenshot" accept="image/jpeg,image/png,image/webp" required />
          </label>
        </>
      )}
      <p className="public-booking-note">
        لا يتم تسجيل الحجز بدون صورة إثبات الدفع. تذكرة واحدة لكل رقم هاتف أو بريد إلكتروني في الليلة الواحدة. يمكن الحجز لليالي أخرى كلٌّ على حدة.
      </p>
      {!demoMode && (
        <label className="public-booking-notification">
          <input type="checkbox" name="notificationConsent" />
          <span>أوافق على تفعيل إشعارات الهاتف لإبلاغي عند اعتماد التذكرة (اختياري).</span>
        </label>
      )}
      <button className="btn" type="submit" disabled={loading || performances.every((performance) => !performance.open)}>
        {loading ? "جارٍ تأكيد الحجز..." : demoMode ? "متابعة للدفع التجريبي" : "تأكيد الحجز وإرسال إثبات الدفع"}
      </button>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </form>
  );
}
