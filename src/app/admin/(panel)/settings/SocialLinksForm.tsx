"use client";

import { useState, type FormEvent } from "react";

type SocialLink = { label: string; url: string };

export default function SocialLinksForm({ initialLinks }: { initialLinks: SocialLink[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  function update(index: number, patch: Partial<SocialLink>) {
    setLinks((current) => current.map((link, i) => i === index ? { ...link, ...patch } : link));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "public", socialLinks: links }),
      });
      if (!response.ok) {
        setFailed(true);
        setMessage(`تعذر حفظ الروابط (${response.status}).`);
        return;
      }
      setMessage("تم حفظ روابط التواصل.");
    } catch {
      setFailed(true);
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card admin-settings-form admin-social-form" onSubmit={submit}>
      <h2>روابط التواصل الاجتماعي</h2>
      <p>أضف رابطًا كاملًا يبدأ بـ https:// لكل منصة، وسيظهر في تذييل الموقع.</p>
      {links.map((link, index) => (
        <div className="admin-social-row" key={index}>
          <input className="field" aria-label="اسم المنصة" placeholder="Instagram" value={link.label} onChange={(event) => update(index, { label: event.currentTarget.value })} required />
          <input className="field" aria-label="رابط المنصة" type="url" placeholder="https://..." value={link.url} onChange={(event) => update(index, { url: event.currentTarget.value })} required />
          <button className="admin-remove-cast" type="button" onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}>إزالة</button>
        </div>
      ))}
      <div className="admin-content-actions">
        <button className="admin-add-cast" type="button" disabled={links.length >= 10} onClick={() => setLinks((current) => [...current, { label: "", url: "" }])}>+ إضافة رابط</button>
        <button className="btn" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ روابط التواصل"}</button>
      </div>
      {message && <p className={`admin-form-status${failed ? " is-error" : ""}`} role="status">{message}</p>}
    </form>
  );
}
