import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PaymentSettingsForm from "./PaymentSettingsForm";
import SocialLinksForm from "./SocialLinksForm";
import AdminSettingDeleteButton from "./AdminSettingDeleteButton";
import AdminPageHeader from "../AdminPageHeader";
import AdminPushToggle from "./AdminPushToggle";

export const dynamic = "force-dynamic";

export default async function SettingsAdmin() {
  if ((await getSession())?.role !== "admin") redirect("/admin/login");
  if (!isMongoConfigured()) return (
    <main className="container admin-page admin-page-narrow">
      <AdminPageHeader eyebrow="تهيئة المنصة" title="إعدادات المنصة" description="اضبط بيانات التحويل وروابط التواصل والإعدادات العامة للموقع." />
      <section className="card admin-empty-state">اربط MongoDB Atlas لحفظ إعدادات الدفع والموقع.</section>
    </main>
  );
  const db = await getDb();
  const [payment, publicSettings] = await Promise.all([
    db.collection("settings").findOne({ key: "payment" }),
    db.collection("settings").findOne({ key: "public" }),
  ]);
  const socialLinks = Array.isArray(publicSettings?.socialLinks)
    ? publicSettings.socialLinks.map((link) => ({
      label: String(link.label || ""),
      url: String(link.url || ""),
    }))
    : [];
  return (
    <main className="container admin-page admin-page-narrow">
      <AdminPageHeader eyebrow="تهيئة المنصة" title="إعدادات المنصة" description="اضبط بيانات التحويل وروابط التواصل والإعدادات العامة للموقع." />
      <PaymentSettingsForm initialSettings={{
        bankName: String(payment?.bankName || ""),
        accountNumber: String(payment?.accountNumber || ""),
        accountHolder: String(payment?.accountHolder || ""),
      }} />
      {payment && <AdminSettingDeleteButton settingKey="payment" label="إعدادات الدفع" />}
      <SocialLinksForm initialLinks={socialLinks} />
      <AdminPushToggle />
      {publicSettings && <AdminSettingDeleteButton settingKey="public" label="روابط التواصل" />}
    </main>
  );
}
