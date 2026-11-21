import { ObjectId } from "mongodb";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import AccountCredentialsForm from "./AccountCredentialsForm";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");

  if (!isMongoConfigured()) {
    return (
      <main className="admin-account-page">
        <Link className="admin-account-back" href="/admin">← العودة إلى لوحة التحكم</Link>
        <h1>الحساب والأمان</h1>
        <p className="admin-account-unavailable">
          تعديل بيانات الدخول غير متاح في وضع العرض التجريبي. اربط قاعدة البيانات أولًا.
        </p>
      </main>
    );
  }

  if (!ObjectId.isValid(session.id)) {
    return (
      <main className="admin-account-page">
        <Link className="admin-account-back" href="/admin">← العودة إلى لوحة التحكم</Link>
        <h1>الحساب والأمان</h1>
        <p className="admin-account-unavailable">
          جلسة الدخول الحالية لا ترتبط بحساب محفوظ. سجّل الخروج من القائمة الجانبية ثم ادخل مجددًا بحساب الإدارة.
        </p>
      </main>
    );
  }

  const db = await getDb();
  const account = await db.collection("admins").findOne(
    { _id: new ObjectId(session.id) },
    { projection: { email: 1, active: 1 } },
  );
  if (!account || account.active === false) redirect("/admin/login");

  return (
    <main className="admin-account-page">
      <Link className="admin-account-back" href="/admin">← العودة إلى لوحة التحكم</Link>
      <header className="admin-account-heading">
        <span>الأمان وإدارة الحساب</span>
        <h1>الحساب والأمان</h1>
        <p>إدارة بريد الدخول وكلمة المرور لحماية حسابك في لوحة BACKSTAGE.</p>
      </header>
      <AccountCredentialsForm currentEmail={String(account.email)} />
    </main>
  );
}
