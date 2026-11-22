import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminPageHeader from "../AdminPageHeader";
import AdminBrandingDeleteButton from "./AdminBrandingDeleteButton";

export const dynamic = "force-dynamic";

const brandingItems = [
  { kind: "mainLogo", label: "الشعار الرئيسي" },
  { kind: "secondaryLogo", label: "الشعار الثانوي" },
  { kind: "favicon", label: "أيقونة الموقع" },
  { kind: "heroBackground", label: "خلفية الواجهة الرئيسية" },
  { kind: "websiteCover", label: "صورة غلاف الموقع" },
  { kind: "showPoster", label: "ملصق العرض" },
  { kind: "ticketLogo", label: "شعار التذكرة" },
  { kind: "ticketBackground", label: "خلفية التذكرة" },
  { kind: "socialImage", label: "صورة المشاركة" },
  { kind: "teamPhoto", label: "صورة فريق BACKSTAGE" },
];

export default async function BrandingAdmin() {
  if ((await getSession())?.role !== "admin") redirect("/admin/login");
  if (!isMongoConfigured()) return (
    <main className="container admin-page">
      <AdminPageHeader eyebrow="مظهر BACKSTAGE" title="هوية العلامة" description="تحكم في الصور والشعارات والعناصر البصرية التي تظهر للزوار." />
      <section className="card admin-empty-state">اربط MongoDB Atlas لتخزين الهوية والملفات في GridFS.</section>
    </main>
  );
  const db = await getDb();
  const branding = await db.collection("settings").findOne({ key: "branding" });
  return (
    <main className="container admin-page">
      <AdminPageHeader eyebrow="مظهر BACKSTAGE" title="هوية العلامة" description="تحكم في الصور والشعارات والعناصر البصرية التي تظهر للزوار." />
      <div className="admin-branding-grid">
        {brandingItems.map(({ kind, label }) => (
          <section className="card admin-branding-card" key={kind}>
            <strong>{label}</strong>
            {branding?.[`${kind}FileId`] ? (
              <>
                <img src={`/api/files/${branding[`${kind}FileId`]}`} alt={label} style={{ width: "100%", maxHeight: 160, objectFit: "contain" }} />
                <AdminBrandingDeleteButton kind={kind} label={label} />
              </>
            ) : null}
            <form action="/api/admin/branding" method="post" encType="multipart/form-data">
              <input type="hidden" name="kind" value={kind} />
              <input className="field" type="file" name="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />
              <button className="btn" type="submit">رفع / استبدال</button>
            </form>
          </section>
        ))}
      </div>
    </main>
  );
}
