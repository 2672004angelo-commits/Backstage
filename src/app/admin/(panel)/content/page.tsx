import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ContentPageForm from "./ContentPageForm";
import AdminPageHeader from "../AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function ContentAdmin() {
  if ((await getSession())?.role !== "admin") redirect("/admin/login");
  if (!isMongoConfigured()) {
    return (
      <main className="container admin-page">
        <AdminPageHeader eyebrow="محتوى الواجهة" title="محتوى الموقع" description="أنشئ الصفحات التعريفية وحدّث نصوصها وروابطها العامة." />
        <section className="card admin-empty-state">اربط MongoDB لحفظ وإدارة الصفحات.</section>
      </main>
    );
  }
  const pages = await (await getDb()).collection("content_pages")
    .find()
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
  return (
    <main className="container admin-page admin-page-narrow">
      <AdminPageHeader eyebrow="محتوى الواجهة" title="محتوى الموقع" description="أنشئ الصفحات التعريفية وحدّث نصوصها وروابطها العامة." />
      <p className="admin-content-intro">أنشئ صفحات مثل «من نحن» و«تواصل معنا». المحتوى نص آمن، والصفحات المنشورة تظهر في التنقل تلقائيًا.</p>
      <ContentPageForm />
      <div className="admin-content-page-list">
        {pages.map((page) => {
          const editable = {
            id: page._id.toString(),
            title: String(page.title),
            slug: String(page.slug),
            content: String(page.content || ""),
            published: Boolean(page.published),
          };
          return (
            <details className="card admin-content-page-item" key={editable.id}>
              <summary>{editable.title} <span dir="ltr">/pages/{editable.slug}</span> — {editable.published ? "منشورة" : "مسودة"}</summary>
              <ContentPageForm page={editable} />
            </details>
          );
        })}
      </div>
    </main>
  );
}
