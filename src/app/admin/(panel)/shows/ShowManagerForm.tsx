"use client";

import { useState, type FormEvent } from "react";
import type { ShowPerformance } from "@/lib/show-performances";

type CastMember = {
  name: string;
  role: string;
  photoFileId?: string;
  photoUrl?: string;
  photoFile?: File;
};

export type ShowEditorData = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  price: number;
  capacity: number;
  open: boolean;
  performances: ShowPerformance[];
  posterFileId?: string;
  posterUrl?: string;
  cast: CastMember[];
};

export default function ShowManagerForm({ initialShow }: { initialShow?: ShowEditorData }) {
  const [cast, setCast] = useState<CastMember[]>(initialShow?.cast || []);
  const [performances, setPerformances] = useState<ShowPerformance[]>(
    initialShow?.performances?.length
      ? initialShow.performances
      : [{
        id: "new-0",
        date: initialShow?.date || "",
        time: initialShow?.time || "",
        open: initialShow?.open ?? true,
      }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updatePerformance(index: number, patch: Partial<ShowPerformance>) {
    setPerformances((current) => current.map((performance, itemIndex) =>
      itemIndex === index ? { ...performance, ...patch } : performance));
  }

  function updateCast(index: number, patch: Partial<CastMember>) {
    setCast((current) => current.map((member, memberIndex) =>
      memberIndex === index ? { ...member, ...patch } : member));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("performances", JSON.stringify(performances));
    form.set("date", performances[0]?.date || "");
    form.set("time", performances[0]?.time || "");
    form.set("open", performances.some((performance) => performance.open) ? "on" : "");
    form.set("cast", JSON.stringify(cast.map(({ name, role, photoFileId }) => ({
      name,
      role,
      ...(photoFileId ? { photoFileId } : {}),
    }))));

    try {
      const response = await fetch("/api/admin/shows", { method: "POST", body: form });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const code = typeof result?.error === "string" ? result.error : `HTTP_${response.status}`;
        setError(`تعذر حفظ العرض: ${code}`);
        return;
      }
      window.location.reload();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card admin-show-form" onSubmit={submit}>
      {initialShow && <input type="hidden" name="id" value={initialShow.id} />}
      <h2>{initialShow ? "تعديل العرض" : "إضافة عرض جديد"}</h2>
      <input className="field" name="title" placeholder="اسم العرض" defaultValue={initialShow?.title} required />
      <textarea className="field" name="description" placeholder="الوصف" defaultValue={initialShow?.description} />
      <div className="admin-show-form-grid">
        <input className="field" name="venue" placeholder="المكان" defaultValue={initialShow?.venue} required />
        <input className="field" name="price" type="number" min="0" placeholder="السعر" defaultValue={initialShow?.price} required />
        <input className="field" name="capacity" type="number" min="1" placeholder="السعة لكل ليلة" defaultValue={initialShow?.capacity} required />
      </div>
      <section className="admin-performance-editor">
        <div className="admin-cast-heading">
          <div>
            <h3>مواعيد ليالي العرض</h3>
            <p>أضف موعدًا لكل ليلة. السعة والسعر يطبّقان على كل ليلة.</p>
          </div>
          <button
            className="admin-add-cast"
            type="button"
            disabled={performances.length >= 20}
            onClick={() => setPerformances((current) => [
              ...current,
              { id: globalThis.crypto.randomUUID(), date: "", time: "", open: true },
            ])}
          >
            + إضافة ليلة
          </button>
        </div>
        <div className="admin-performance-list">
          {performances.map((performance, index) => (
            <div className="admin-performance-row" key={performance.id}>
              <span className="admin-performance-number">الليلة {index + 1}</span>
              <label>
                <span>التاريخ</span>
                <input className="field" type="date" value={performance.date} required onChange={(event) => updatePerformance(index, { date: event.currentTarget.value })} />
              </label>
              <label>
                <span>الوقت</span>
                <input className="field" type="time" value={performance.time} required onChange={(event) => updatePerformance(index, { time: event.currentTarget.value })} />
              </label>
              <label className="admin-performance-open">
                <input type="checkbox" checked={performance.open} onChange={(event) => updatePerformance(index, { open: event.currentTarget.checked })} />
                الحجز مفتوح
              </label>
              <button
                className="admin-remove-cast"
                type="button"
                disabled={performances.length <= 1}
                onClick={() => setPerformances((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                إزالة الليلة
              </button>
            </div>
          ))}
        </div>
      </section>
      <label className="admin-show-upload">
        صورة العرض
        {initialShow?.posterUrl && <img src={initialShow.posterUrl} alt="صورة العرض الحالية" />}
        <input className="field" type="file" name="poster" accept="image/jpeg,image/png,image/webp" />
      </label>
      <section className="admin-cast-editor">
        <div className="admin-cast-heading">
          <div><h3>كاست العرض</h3><p>أضف أسماء الفنانين وصورهم لتظهر تلقائيًا في صفحة الكاست.</p></div>
          <button
            className="admin-add-cast"
            type="button"
            disabled={cast.length >= 30}
            onClick={() => setCast((current) => [...current, { name: "", role: "" }])}
          >
            + إضافة فنان
          </button>
        </div>
        {cast.map((member, index) => (
          <div className="admin-cast-row" key={`${member.photoFileId || "new"}-${index}`}>
            <input
              className="field"
              value={member.name}
              onChange={(event) => updateCast(index, { name: event.currentTarget.value })}
              placeholder="اسم الفنان"
              required
            />
            <input
              className="field"
              value={member.role}
              onChange={(event) => updateCast(index, { role: event.currentTarget.value })}
              placeholder="الدور (اختياري)"
            />
            {member.photoUrl && !member.photoFile && <img className="admin-cast-preview" src={member.photoUrl} alt={`صورة ${member.name}`} />}
            <input
              className="field"
              type="file"
              name={`castPhoto-${index}`}
              accept="image/jpeg,image/png,image/webp"
              required={!member.photoFileId}
              onChange={(event) => updateCast(index, { photoFile: event.currentTarget.files?.[0] })}
            />
            <button className="admin-remove-cast" type="button" onClick={() => setCast((current) => current.filter((_, i) => i !== index))}>
              إزالة
            </button>
          </div>
        ))}
      </section>

      <button className="btn" type="submit" disabled={saving}>
        {saving ? "جارٍ الحفظ..." : initialShow ? "حفظ تعديلات العرض" : "إنشاء العرض"}
      </button>
      {error && <p className="admin-form-status is-error" role="alert">{error}</p>}
    </form>
  );
}
