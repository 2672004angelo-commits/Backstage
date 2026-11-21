"use client";

import { useState, type FormEvent } from "react";

export type EditablePage = { id: string; title: string; slug: string; content: string; published: boolean };

export default function ContentPageForm({ page }: { page?: EditablePage }) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(page ? { id: page.id } : {}),
          title: String(form.get("title") || ""),
          slug: String(form.get("slug") || ""),
          content: String(form.get("content") || ""),
          published: form.has("published"),
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const reason = typeof result?.error === "string" ? result.error : `HTTP_${response.status}`;
        setError(`تعذر حفظ الصفحة: ${reason}`);
        return;
      }
      window.location.reload();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  async function removePage() {
    if (!page || !window.confirm(`حذف صفحة «${page.title}»؟`)) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/pages", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: page.id }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const reason = typeof result?.error === "string" ? result.error : `HTTP_${response.status}`;
        setError(`تعذر حذف الصفحة: ${reason}`);
        return;
      }
      window.location.reload();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className="card admin-content-page-form" onSubmit={submit}>
      <h2>{page ? "تعديل صفحة" : "إنشاء صفحة جديدة"}</h2>
      <input className="field" name="title" placeholder="اسم الصفحة، مثل من نحن" defaultValue={page?.title} required />
      <label className="admin-content-slug">
        رابط الصفحة
        <span dir="ltr">/pages/</span>
        <input className="field" name="slug" placeholder="about-us" defaultValue={page?.slug} pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*" maxLength={80} required />
      </label>
      <textarea className="field admin-content-textarea" name="content" placeholder="اكتب محتوى الصفحة هنا" defaultValue={page?.content} />
      <label className="admin-content-published"><input name="published" type="checkbox" defaultChecked={page?.published ?? true} /> نشر الصفحة وإظهارها في التنقل</label>
      <div className="admin-content-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ..." : page ? "حفظ الصفحة" : "إنشاء الصفحة"}</button>
        {page && <button className="admin-remove-cast" type="button" disabled={deleting} onClick={removePage}>{deleting ? "جارٍ الحذف..." : "حذف الصفحة"}</button>}
      </div>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </form>
  );
}
