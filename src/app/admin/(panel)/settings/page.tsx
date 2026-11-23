import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SocialLinksForm from "./SocialLinksForm";
import AdminSettingDeleteButton from "./AdminSettingDeleteButton";
import AdminPageHeader from "../AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function SettingsAdmin() {
  if ((await getSession())?.role !== "admin") redirect("/admin/login");
  if (!isMongoConfigured()) return (
    <main className="container admin-page admin-page-narrow">
      <AdminPageHeader eyebrow="تهيئة المنصة" title="إعدادات المنصة" description="اضبط روابط التواصل الاجتماعي التي تظهر في تذييل الموقع." />
      <section className="card admin-empty-state">اربط MongoDB Atlas لحفظ إعدادات الدفع والموقع.</section>
    </main>
  );
  const db = await getDb();
  const publicSettings = await db.collection("settings").findOne({ key: "public" });
  const socialLinks = Array.isArray(publicSettings?.socialLinks)
    ? publicSettings.socialLinks.map((link) => ({
      label: String(link.label || ""),
      url: String(link.url || ""),
    }))
    : [];
  return (
    <main className="container admin-page admin-page-narrow">
      <AdminPageHeader eyebrow="تهيئة المنصة" title="إعدادات المنصة" description="اضبط روابط التواصل الاجتماعي التي تظهر في تذييل الموقع." />
      <SocialLinksForm initialLinks={socialLinks} />
      {publicSettings && <AdminSettingDeleteButton settingKey="public" label="روابط التواصل" />}
    </main>
  );
}
