"use client";

import { useState } from "react";

export default function AdminBrandingDeleteButton({ kind, label }: { kind: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy || !window.confirm(`سيتم حذف ${label} الحالي نهائيًا. هل تريد المتابعة؟`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/branding", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!response.ok) {
        setError(`تعذر حذف ${label} (${response.status}).`);
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
        {busy ? "جارٍ الحذف..." : `حذف ${label}`}
      </button>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </div>
  );
}
