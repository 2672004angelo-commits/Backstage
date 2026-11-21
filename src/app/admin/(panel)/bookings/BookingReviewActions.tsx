"use client";

import { useState } from "react";

type ReviewAction = "approve" | "reject";

export default function BookingReviewActions({ bookingId, approved = false }: { bookingId: string; approved?: boolean }) {
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [error, setError] = useState("");

  async function submitAction(action: ReviewAction) {
    setError("");
    let reason: string | undefined;
    if (action === "reject") {
      const enteredReason = window.prompt("سبب الرفض");
      if (enteredReason === null) return;
      reason = enteredReason.trim();
      if (!reason) {
        setError("سبب الرفض مطلوب.");
        return;
      }
    }

    setPendingAction(action);
    try {
      const response = await fetch(`/api/admin/payments/${encodeURIComponent(bookingId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      if (!response.ok) {
        setError(response.status === 401
          ? "انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى."
          : `تعذر تحديث حالة الدفع (${response.status}).`);
        return;
      }
      window.location.reload();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="admin-booking-actions" aria-busy={pendingAction !== null}>
      <div>
        <button className="btn" type="button" disabled={pendingAction !== null} onClick={() => void submitAction("approve")}>
          {pendingAction === "approve" ? "جارٍ الاعتماد..." : approved ? "استكمال إصدار التذكرة" : "اعتماد الدفع"}
        </button>
        {!approved && <button className="btn admin-danger-btn" type="button" disabled={pendingAction !== null} onClick={() => void submitAction("reject")}>
          {pendingAction === "reject" ? "جارٍ الرفض..." : "رفض الدفع"}
        </button>}
      </div>
      {error && <p className="admin-action-error" role="alert">{error}</p>}
    </div>
  );
}
