"use client";

import { useState, type FormEvent } from "react";

type PaymentSettings = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

export default function PaymentSettingsForm({ initialSettings }: { initialSettings: PaymentSettings }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSaveFailed(false);
    const form = new FormData(event.currentTarget);
    const body = {
      key: "payment",
      bankName: String(form.get("bankName") || ""),
      accountNumber: String(form.get("accountNumber") || ""),
      accountHolder: String(form.get("accountHolder") || ""),
    };

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setSaveFailed(true);
        setMessage(`تعذر حفظ الإعدادات (${response.status}).`);
        return;
      }
      setMessage("تم الحفظ");
    } catch {
      setSaveFailed(true);
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card admin-settings-form" onSubmit={submit}>
      <input type="hidden" name="key" value="payment" />
      <input className="field" name="bankName" defaultValue={initialSettings.bankName} placeholder="اسم البنك أو المحفظة" />
      <input className="field" name="accountNumber" defaultValue={initialSettings.accountNumber} placeholder="رقم الحساب" />
      <input className="field" name="accountHolder" defaultValue={initialSettings.accountHolder} placeholder="اسم المستفيد" />
      <button className="btn" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ إعدادات الدفع"}</button>
      {message && <p className={`admin-form-status${saveFailed ? " is-error" : ""}`} role="status">{message}</p>}
    </form>
  );
}
