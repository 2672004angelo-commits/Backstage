"use client";

import { useState } from "react";
import LanguageToggle from "../LanguageToggle";

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
    <main className="public-ambient-page">
      <div className="public-ambient-content is-narrow">
        <div className="public-page-locale"><LanguageToggle /></div>
        <h1 className="public-transaction-title">واجهة دخول الحضور</h1>
        <div className="card public-checkin-card">
          <label>رمز التذكرة أو رمز QR
            <input className="field" dir="ltr" placeholder="BACKSTAGE GUEST-000001" value={token} onChange={(event) => setToken(event.target.value)} />
          </label>
          <button className="btn" type="button" onClick={scan}>تحقق من التذكرة</button>
          {result && <strong className="public-checkin-result">{result}</strong>}
        </div>
        <p className="public-transaction-intro">تتطلب هذه الواجهة دخول موظف أو مسؤول.</p>
      </div>
    </main>
  );
}
