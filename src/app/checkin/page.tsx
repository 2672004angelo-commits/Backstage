"use client";

import { useState } from "react";

export default function CheckinPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState("");
  async function scan() {
    setResult("جاري التحقق...");
    const response = await fetch("/api/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    setResult(data.status === "VALID"
      ? `تم التحقق من التذكرة · ${data.ticket?.guestName || ""} · ${data.ticket?.date || ""} ${data.ticket?.time || ""}`
      : data.status || "INVALID");
  }
  return (
    <main className="container" style={{ maxWidth: 680, padding: "48px 16px" }}>
      <h1>واجهة دخول الحضور</h1>
      <div className="card" style={{ padding: 24, display: "grid", gap: 16 }}>
        <label>رمز التذكرة أو رمز QR
          <input className="field" dir="ltr" placeholder="BACKSTAGE GUEST-000001" value={token} onChange={(event) => setToken(event.target.value)} />
        </label>
        <button className="btn" type="button" onClick={scan}>تحقق من التذكرة</button>
        {result && <strong style={{ fontSize: 24, textAlign: "center" }}>{result}</strong>}
      </div>
      <p style={{ color: "#777", marginTop: 24 }}>تتطلب هذه الواجهة دخول موظف أو مسؤول.</p>
    </main>
  );
}
