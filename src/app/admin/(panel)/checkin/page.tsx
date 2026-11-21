"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "../AdminPageHeader";

export default function AdminCheckinPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState("");
  const [resultType, setResultType] = useState<"idle" | "success" | "error">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ticketCode = new URLSearchParams(window.location.search).get("code");
    if (ticketCode) setToken(ticketCode);
  }, []);

  async function verifyTicket() {
    const value = token.trim();
    if (!value) {
      setResult("أدخل كود التذكرة أولًا.");
      setResultType("error");
      return;
    }
    setBusy(true);
    setResult("جاري التحقق...");
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const data = await response.json();
      if (data.status === "VALID") {
        setResult(`تم تسجيل الدخول · ${data.ticket.guestName} · ${data.ticket.date} · ${data.ticket.time}`);
        setResultType("success");
      } else if (data.status === "ALREADY_USED") {
        setResult("هذه التذكرة دخلت مسبقًا وصلاحيتها منتهية.");
        setResultType("error");
      } else if (data.status === "CANCELLED") {
        setResult("التذكرة ملغاة.");
        setResultType("error");
      } else {
        setResult("كود التذكرة غير صحيح أو غير نشط.");
        setResultType("error");
      }
    } catch {
      setResult("تعذر الاتصال بخدمة التحقق.");
      setResultType("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container admin-page">
      <AdminPageHeader
        eyebrow="بوابة المسرح"
        title="دخول الحضور"
        description="تحقق من التذكرة عند البوابة واعتمد دخول الضيف مرة واحدة لكل ليلة."
      />
      <section className="admin-checkin-stage">
        <div className="admin-checkin-stage-light" aria-hidden="true" />
        <div className="admin-checkin-panel">
          <div className="admin-checkin-mark" aria-hidden="true">B</div>
          <div className="admin-checkin-copy">
            <span>فحص التذكرة</span>
            <h2>بوابة دخول العرض</h2>
          </div>
          <label className="admin-checkin-field">
            كود التذكرة
            <input
              className="field"
              dir="ltr"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void verifyTicket();
              }}
              placeholder="BACKSTAGE GUEST-000001"
              autoComplete="off"
              autoFocus
            />
          </label>
          <button className="admin-checkin-submit" type="button" onClick={() => void verifyTicket()} disabled={busy}>
            <span aria-hidden="true">✓</span>
            {busy ? "جارٍ التحقق..." : "اعتماد دخول الضيف"}
          </button>
          {result && (
            <p className={`admin-checkin-result is-${resultType}`} role="status" aria-live="polite">
              {result}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
