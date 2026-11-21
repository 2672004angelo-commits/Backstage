"use client";

import { useState, type FormEvent } from "react";
import type { ShowPerformance } from "@/lib/show-performances";

const errorMessages: Record<string, string> = {
  BOOKING_ALREADY_EXISTS: "للضيف حجز آخر في الليلة المختارة.",
  BOOKING_HAS_ISSUED_TICKETS: "لا يمكن تعديل حجز صدرت له تذاكر؛ يمكن حذفه أو تعديل حجز غير معتمد.",
  BOOKING_HAS_USED_TICKETS: "لا يمكن حذف حجز تم استخدام إحدى تذاكره.",
  NOT_ENOUGH_CAPACITY: "لا توجد مقاعد كافية في الليلة المختارة.",
  PERFORMANCE_UNAVAILABLE: "الليلة المختارة غير متاحة.",
};

export default function AdminBookingActions({
  bookingId,
  fullName,
  mobile,
  email,
  performanceId,
  performances,
  canEdit,
}: {
  bookingId: string;
  fullName: string;
  mobile: string;
  email: string;
  performanceId: string;
  performances: ShowPerformance[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: String(form.get("fullName") || ""),
          mobile: String(form.get("mobile") || ""),
          email: String(form.get("email") || ""),
          performanceId: String(form.get("performanceId") || ""),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const code = typeof data?.error === "string" ? data.error : "";
        setError(errorMessages[code] || `تعذر تعديل الحجز (${response.status}).`);
        return;
      }
      window.location.reload();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !window.confirm("سيتم حذف الحجز نهائيًا مع إثباتات الدفع والتذاكر المرتبطة. هل تريد المتابعة؟")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const code = typeof data?.error === "string" ? data.error : "";
        setError(errorMessages[code] || `تعذر حذف الحجز (${response.status}).`);
        return;
      }
      window.location.reload();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-record-actions">
      {canEdit && (
        <button className="admin-add-cast" type="button" onClick={() => { setEditing((value) => !value); setError(""); }}>
          {editing ? "إغلاق التعديل" : "تعديل الحجز"}
        </button>
      )}
      <button className="admin-remove-cast" type="button" disabled={busy} onClick={() => void remove()}>
        {busy && !editing ? "جارٍ الحذف..." : "حذف الحجز"}
      </button>
      {editing && canEdit && (
        <form className="admin-record-edit-form" onSubmit={save}>
          <label>اسم الضيف<input className="field" name="fullName" defaultValue={fullName} required minLength={7} /></label>
          <label>رقم الهاتف<input className="field" name="mobile" type="tel" defaultValue={mobile} required pattern="[+]?[0-9]{8,15}" /></label>
          <label>البريد الإلكتروني<input className="field" name="email" type="email" defaultValue={email} /></label>
          <label>ليلة العرض
            <select className="field" name="performanceId" defaultValue={performanceId} required>
              {performances.map((performance, index) => (
                <option key={performance.id} value={performance.id} disabled={!performance.open && performance.id !== performanceId}>
                  {`الليلة ${index + 1} — ${performance.date}، ${performance.time}${performance.open ? "" : " (مغلقة)"}`}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ تعديلات الحجز"}</button>
        </form>
      )}
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </div>
  );
}
