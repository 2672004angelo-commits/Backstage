"use client";

import { useState } from "react";

export default function AdminTicketActions({
  ticketId,
  status,
  checkedIn,
}: {
  ticketId: string;
  status: string;
  checkedIn: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: "ACTIVE" | "CANCELLED") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        setError(response.status === 409
          ? "لا يمكن تعديل تذكرة تم استخدامها."
          : `تعذر تعديل التذكرة (${response.status}).`);
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
    if (busy || !window.confirm("سيتم حذف نسخة التذكرة نهائيًا. هل تريد المتابعة؟")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}`, { method: "DELETE" });
      if (!response.ok) {
        setError(response.status === 409
          ? "لا يمكن حذف تذكرة تم استخدامها."
          : `تعذر حذف التذكرة (${response.status}).`);
        return;
      }
      window.location.reload();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  if (checkedIn) return <p className="admin-ticket-locked">لا يمكن تعديل أو حذف تذكرة تم استخدامها.</p>;
  return (
    <div className="admin-record-actions">
      <button className="admin-add-cast" type="button" disabled={busy} onClick={() => void updateStatus(status === "CANCELLED" ? "ACTIVE" : "CANCELLED")}>
        {busy ? "جارٍ التحديث..." : status === "CANCELLED" ? "إعادة تفعيل التذكرة" : "إلغاء التذكرة"}
      </button>
      <button className="admin-remove-cast" type="button" disabled={busy} onClick={() => void remove()}>
        حذف نهائي
      </button>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </div>
  );
}
