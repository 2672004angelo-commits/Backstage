"use client";

import { useState, type FormEvent } from "react";

export default function AccountCredentialsForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [savedEmail, setSavedEmail] = useState(currentEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setFailed(false);

    const body: { currentPassword: string; newEmail?: string; newPassword?: string } = {
      currentPassword,
    };
    if (email.trim().toLowerCase() !== savedEmail.toLowerCase()) {
      body.newEmail = email.trim();
    }
    if (newPassword) body.newPassword = newPassword;

    if (!body.newEmail && !body.newPassword) {
      setFailed(true);
      setMessage("عدّل البريد أو أدخل كلمة مرور جديدة قبل الحفظ.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      if (response.status === 403) {
        setFailed(true);
        setMessage("كلمة المرور الحالية غير صحيحة.");
        return;
      }
      if (response.status === 409) {
        setFailed(true);
        setMessage("هذا البريد الإلكتروني مستخدم لحساب آخر.");
        return;
      }
      if (!response.ok) {
        setFailed(true);
        setMessage("تعذر تحديث بيانات الحساب. تحقق من المدخلات وحاول مرة أخرى.");
        return;
      }

      const updatedEmail = email.trim().toLowerCase();
      setEmail(updatedEmail);
      setSavedEmail(updatedEmail);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("تم تحديث بيانات الحساب بنجاح.");
    } catch {
      setFailed(true);
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card admin-settings-form admin-account-form" onSubmit={submit}>
      <div className="admin-account-form-heading">
        <h2>بيانات تسجيل الدخول</h2>
        <p>حدّث بريد الإدارة أو كلمة المرور. نطلب كلمة المرور الحالية لتأكيد التغيير.</p>
      </div>
      <label className="admin-account-field">
        <span>البريد الإلكتروني</span>
        <input
          className="field"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
      </label>
      <label className="admin-account-field">
        <span>كلمة المرور الحالية</span>
        <input
          className="field"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.currentTarget.value)}
          minLength={8}
          maxLength={128}
          required
        />
      </label>
      <label className="admin-account-field">
        <span>كلمة المرور الجديدة <small>(اتركها فارغة إذا لم ترد تغييرها)</small></span>
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.currentTarget.value)}
          minLength={8}
          maxLength={128}
        />
      </label>
      <div className="admin-content-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "جارٍ تحديث الحساب..." : "حفظ بيانات الحساب"}
        </button>
      </div>
      {message && (
        <p className={`admin-form-status${failed ? " is-error" : ""}`} role={failed ? "alert" : "status"}>
          {message}
        </p>
      )}
    </form>
  );
}
