"use client";

import { useState, type FormEvent } from "react";

export default function PaymentUploadForm({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      window.location.replace(`/payment/${encodeURIComponent(bookingId)}?submitted=1`);
    } catch (uploadError) {
      setError(uploadError instanceof Error
        ? "تعذر رفع إثبات التحويل. تأكد من الصورة وحدودها وحاول مرة أخرى."
        : "تعذر رفع إثبات التحويل.");
    } finally {
      setLoading(false);
    }
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
    </form>
  );
}
