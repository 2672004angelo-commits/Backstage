"use client";

import { useState, type FormEvent } from "react";

export type EditablePage = { id: string; title: string; slug: string; content: string; published: boolean };

function splitContent(content = "") {
  const paragraphs = content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs : [""];
}

export default function ContentPageForm({ page }: { page?: EditablePage }) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [contentBlocks, setContentBlocks] = useState(() => splitContent(page?.content));

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
          content: contentBlocks.map((block) => block.trim()).filter(Boolean).join("\n\n"),
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
      <div className="admin-content-blocks">
        <div className="admin-content-blocks-heading">
          <div>
            <h3>نصوص الصفحة</h3>
            <p>قسّم المحتوى إلى فقرات؛ ستظهر للزائر بالترتيب نفسه.</p>
          </div>
          <button
            className="admin-add-cast"
            type="button"
            onClick={() => setContentBlocks((blocks) => [...blocks, ""])}
          >
            + إضافة فقرة
          </button>
        </div>
        {contentBlocks.map((block, index) => (
          <section className="admin-content-block" key={index}>
            <div className="admin-content-block-toolbar">
              <label htmlFor={`content-block-${page?.id || "new"}-${index}`}>الفقرة {String(index + 1).padStart(2, "0")}</label>
              <div>
                <button
                  className="admin-content-move-block"
                  type="button"
                  aria-label={`نقل الفقرة ${index + 1} لأعلى`}
                  disabled={index === 0}
                  onClick={() => setContentBlocks((blocks) => {
                    const reordered = [...blocks];
                    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
                    return reordered;
                  })}
                >
                  ↑
                </button>
                <button
                  className="admin-content-move-block"
                  type="button"
                  aria-label={`نقل الفقرة ${index + 1} لأسفل`}
                  disabled={index === contentBlocks.length - 1}
                  onClick={() => setContentBlocks((blocks) => {
                    const reordered = [...blocks];
                    [reordered[index + 1], reordered[index]] = [reordered[index], reordered[index + 1]];
                    return reordered;
                  })}
                >
                  ↓
                </button>
              </div>
            </div>
            <textarea
              className="field admin-content-textarea"
              id={`content-block-${page?.id || "new"}-${index}`}
              value={block}
              onChange={(event) => setContentBlocks((blocks) => blocks.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
              placeholder="اكتب فقرة من محتوى الصفحة"
            />
            {contentBlocks.length > 1 && (
              <button
                className="admin-remove-cast admin-content-remove-block"
                type="button"
                onClick={() => setContentBlocks((blocks) => blocks.filter((_, itemIndex) => itemIndex !== index))}
              >
                حذف الفقرة
              </button>
            )}
          </section>
        ))}
      </div>
      <label className="admin-content-published"><input name="published" type="checkbox" defaultChecked={page?.published ?? true} /> نشر الصفحة وإظهارها في التنقل</label>
      <div className="admin-content-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ..." : page ? "حفظ الصفحة" : "إنشاء الصفحة"}</button>
        {page && <button className="admin-remove-cast" type="button" disabled={deleting} onClick={removePage}>{deleting ? "جارٍ الحذف..." : "حذف الصفحة"}</button>}
      </div>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </form>
  );
}
