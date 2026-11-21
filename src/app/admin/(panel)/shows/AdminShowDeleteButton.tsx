"use client";

import { useState } from "react";

export default function AdminShowDeleteButton({ showId }: { showId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy || !window.confirm("سيتم حذف العرض وصوره نهائيًا. لا يمكن حذف عرض لديه حجوزات. هل تريد المتابعة؟")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shows", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: showId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error === "SHOW_HAS_BOOKINGS"
          ? "لا يمكن حذف العرض قبل حذف حجوزاته."
          : `تعذر حذف العرض (${response.status}).`);
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
      <button className="admin-remove-cast" type="button" disabled={busy} onClick={() => void remove()}>
        {busy ? "جارٍ الحذف..." : "حذف العرض"}
      </button>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </div>
  );
}
