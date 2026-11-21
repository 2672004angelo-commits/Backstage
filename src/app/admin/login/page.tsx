"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    if (response.ok) window.location.href = "/admin";
    else setError("بيانات الدخول غير صحيحة");
  }
  return (
    <main className="admin-login-page">
      <div className="admin-login-stage" aria-hidden="true">
        <span className="admin-login-curtain admin-login-curtain-start" />
        <span className="admin-login-curtain admin-login-curtain-end" />
        <div className="admin-login-splash-logo">
          <span>B</span>
          <strong>BACKSTAGE</strong>
        </div>
      </div>
      <form className="admin-login-card card" onSubmit={submit}>
        <div className="admin-login-brand" aria-label="BACKSTAGE">
          <span className="admin-login-mark" aria-hidden="true">B</span>
          <span>BACKSTAGE</span>
        </div>
        <h1>دخول الإدارة</h1>
        <input className="field" name="email" type="email" placeholder="البريد الإلكتروني" required />
        <div className="admin-login-password">
          <input className="field" name="password" type={showPassword ? "text" : "password"} placeholder="كلمة المرور" minLength={8} required />
          <button
            className="admin-login-password-toggle"
            type="button"
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? "إخفاء" : "إظهار"}
          </button>
        </div>
        {error && <p className="admin-login-error">{error}</p>}
        <button className="btn" type="submit">دخول</button>
        <p className="admin-login-hint">سجّل الدخول للوصول إلى لوحة إدارة BACKSTAGE.</p>
      </form>
    </main>
  );
}
