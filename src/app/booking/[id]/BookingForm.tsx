"use client";

import { useState, type FormEvent } from "react";
import { getShowPerformances } from "@/lib/show-performances";

type Performance = ReturnType<typeof getShowPerformances>[number];

const bookingErrors: Record<string, string> = {
  DATABASE_NOT_CONFIGURED: "خدمة الحجز غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.",
  SHOW_UNAVAILABLE: "هذا العرض غير متاح للحجز حاليًا.",
  PERFORMANCE_REQUIRED: "اختر ليلة العرض قبل تأكيد الحجز.",
  PERFORMANCE_UNAVAILABLE: "ليلة العرض المختارة لم تعد متاحة. حدّث الصفحة واختر موعدًا آخر.",
  BOOKING_ALREADY_EXISTS: "لديك حجز مسجل لهذه الليلة بالفعل. راجع صفحة «حجوزاتي» أو ارفع إثبات الدفع للحجز السابق.",
  NOT_ENOUGH_CAPACITY: "اكتمل عدد المقاعد المتاحة لهذه الليلة. اختر ليلة أخرى إن توفرت.",
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
    };

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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
              {`الليلة ${index + 1} — ${performance.date}، ${performance.time}${performance.open ? "" : " (الحجز مغلق)"}`}
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
      <button className="btn" type="submit" disabled={loading || performances.every((performance) => !performance.open)}>
        {loading ? "جارٍ تأكيد الحجز..." : demoMode ? "متابعة للدفع التجريبي" : "تأكيد الحجز والدفع"}
      </button>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </form>
  );
}
