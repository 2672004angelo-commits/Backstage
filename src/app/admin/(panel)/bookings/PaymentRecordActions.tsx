"use client";

import { useState } from "react";

export default function PaymentRecordActions({
  bookingId,
  paymentId,
  paymentMethod,
  isLatest,
  editable,
}: {
  bookingId: string;
  paymentId: string;
  paymentMethod: string;
  isLatest: boolean;
  editable: boolean;
}) {
  const [method, setMethod] = useState(paymentMethod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(action: "update_method" | "delete_payment") {
    if (busy) return;
    if (action === "delete_payment" && !window.confirm("سيتم حذف إثبات الدفع نهائيًا. هل تريد المتابعة؟")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payments/${encodeURIComponent(bookingId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          paymentId,
          ...(action === "update_method" ? { paymentMethod: method } : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const messages: Record<string, string> = {
          APPROVED_PAYMENT_LOCKED: "لا يمكن تعديل إثبات دفع لحجز معتمد.",
          PAYMENT_NOT_LATEST: "يمكن حذف أحدث إثبات دفع فقط.",
        };
        const code = typeof data?.error === "string" ? data.error : "";
        setError(messages[code] || `تعذر تنفيذ الإجراء (${response.status}).`);
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
    <div className="admin-payment-record-actions">
      {editable ? (
        <>
          <label>
            طريقة التحويل
            <select className="field" value={method} onChange={(event) => setMethod(event.currentTarget.value)}>
              <option value="INSTAPAY">Instapay</option>
              <option value="CASH_WALLET">محفظة كاش</option>
            </select>
          </label>
          {method !== paymentMethod && (
            <button className="admin-add-cast" type="button" disabled={busy} onClick={() => void submit("update_method")}>
              حفظ طريقة الدفع
            </button>
          )}
          {isLatest && (
            <button className="admin-remove-cast" type="button" disabled={busy} onClick={() => void submit("delete_payment")}>
              حذف إثبات الدفع
            </button>
          )}
        </>
      ) : <span className="admin-payment-locked">لا يمكن تعديل إثبات دفع لحجز معتمد.</span>}
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </div>
  );
}
