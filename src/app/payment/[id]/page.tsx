import type { Metadata } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { demoShows } from "@/lib/demo";

export const metadata: Metadata = {
  title: "الدفع",
  robots: { index: false, follow: false },
};

export default async function PaymentPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { id } = await params;
  const submitted = (await searchParams).submitted;
  if (!ObjectId.isValid(id)) notFound();
  if (!isMongoConfigured()) {
    const demo = demoShows.find((item) => item._id === id);
    if (!demo) notFound();
    return (
      <main className="container" style={{ maxWidth: 760, padding: "48px 0" }}>
        <h1>الدفع اليدوي</h1>
        <section className="card" style={{ padding: 28 }}>
          <p>عرض تجريبي: <strong>{demo.title}</strong></p>
          <p>المبلغ المستحق: <strong style={{ color: "var(--gold)", fontSize: 24 }}>{demo.price.toLocaleString("ar")} د.ع</strong></p>
          <div style={{ lineHeight: 2, background: "#101114", padding: 16, borderRadius: 8 }}>
            <p>بنك الرافدين</p><p>رقم الحساب: IQ98 8000 1234 5678 9012</p><p>المستفيد: BACKSTAGE</p>
          </div>
          {submitted ? (
            <section style={{ marginTop: 24, textAlign: "center", border: "1px solid #c4a86a", borderRadius: 8, padding: 20 }}>
              <h2>تم رفع إثبات الدفع بنجاح</h2><p>حجزك في وضع الانتظار للمراجعة.</p>
            </section>
          ) : (
            <form action={`/payment/${id}?submitted=1`} method="get" style={{ display: "grid", gap: 16, marginTop: 24 }}>
              <label>طريقة التحويل
                <select className="field" name="paymentMethod" required>
                  <option value="" disabled selected>اختر Instapay أو محفظة كاش</option>
                  <option value="INSTAPAY">Instapay</option>
                  <option value="CASH_WALLET">محفظة كاش</option>
                </select>
              </label>
              <label>صورة إثبات الدفع (عرض تجريبي)<input className="field" type="file" accept="image/jpeg,image/png,image/webp" /></label>
              <button className="btn" type="submit">رفع إثبات الدفع التجريبي</button>
            </form>
          )}
        </section>
      </main>
    );
  }
  const db = await getDb();
  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(id) });
  if (!booking) {
    const demo = demoShows.find((item) => item._id === id);
    if (!demo) notFound();
    return (
      <main className="container" style={{ maxWidth: 760, padding: "48px 0" }}>
        <h1>الدفع اليدوي</h1>
        <section className="card" style={{ padding: 28 }}>
          <p>عرض تجريبي: <strong>{demo.title}</strong></p>
          <p>المبلغ المستحق: <strong style={{ color: "var(--gold)", fontSize: 24 }}>{demo.price.toLocaleString("ar")} د.ع</strong></p>
          <div style={{ lineHeight: 2, background: "#101114", padding: 16, borderRadius: 8 }}>
            <p>بنك الرافدين</p><p>رقم الحساب: IQ98 8000 1234 5678 9012</p><p>المستفيد: BACKSTAGE</p>
          </div>
          {submitted ? (
            <section style={{ marginTop: 24, textAlign: "center", border: "1px solid #c4a86a", borderRadius: 8, padding: 20 }}>
              <h2>تم رفع إثبات الدفع بنجاح</h2><p>حجزك في وضع الانتظار للمراجعة.</p>
            </section>
          ) : (
            <form action={`/payment/${id}?submitted=1`} method="get" style={{ display: "grid", gap: 16, marginTop: 24 }}>
              <label>صورة إثبات الدفع (عرض تجريبي)<input className="field" type="file" accept="image/jpeg,image/png,image/webp" /></label>
              <button className="btn" type="submit">رفع إثبات الدفع التجريبي</button>
            </form>
          )}
        </section>
      </main>
    );
  }
  const settings = await db.collection("settings").findOne({ key: "payment" });
  return (
    <main className="container" style={{ maxWidth: 760, padding: "48px 0" }}>
      {submitted ? (
        <section className="card" style={{ padding: 28, textAlign: "center", borderColor: "#c4a86a" }}>
          <h1>تم رفع إثبات الدفع</h1>
          <p>حجزك بانتظار مراجعة الإدارة. لن يتم إصدار التذاكر قبل الموافقة على الدفع.</p>
          <a className="btn" href="/bookings">تابع حالة الحجز والتذكرة</a>
        </section>
      ) : null}
      <section className="card" style={{ marginTop: 24, padding: 28 }}>
        <h1>الدفع اليدوي</h1>
        <p>رقم الحجز: <code dir="ltr">{id}</code></p>
        <p>موعد العرض: <strong>{String(booking.showSnapshot?.date || "")} · {String(booking.showSnapshot?.time || "")}</strong></p>
        <p>المبلغ المستحق: <strong style={{ color: "var(--gold)" }}>{Number(booking.totalAmount).toLocaleString("ar")} د.ع</strong></p>
        <div style={{ direction: "rtl", lineHeight: 2, background: "#101114", padding: 16, borderRadius: 8 }}>
          <p>الحساب البنكي أو المحفظة: {String(settings?.bankName || "سيتم تهيئته من لوحة الإدارة")}</p>
          <p>رقم الحساب: {String(settings?.accountNumber || "—")}</p>
          <p>اسم المستفيد: {String(settings?.accountHolder || "—")}</p>
        </div>
        {["PENDING_PAYMENT", "REJECTED"].includes(booking.status) ? (
          <form action="/api/payments" method="post" encType="multipart/form-data" style={{ display: "grid", gap: 16, marginTop: 24 }}>
            <input type="hidden" name="bookingId" value={id} />
          <label>طريقة التحويل
            <select className="field" name="paymentMethod" required>
              <option value="" disabled selected>اختر Instapay أو محفظة كاش</option>
              <option value="INSTAPAY">Instapay</option>
              <option value="CASH_WALLET">محفظة كاش</option>
            </select>
          </label>
          <label>صورة إثبات التحويل (JPEG أو PNG أو WebP، حتى 8 ميجابايت)
              <input className="field" type="file" name="screenshot" accept="image/jpeg,image/png,image/webp" required />
            </label>
            <button className="btn" type="submit">رفع إثبات الدفع</button>
          </form>
        ) : (
          <div style={{ marginTop: 24 }}>
            <p>حالة الحجز: <strong>{booking.status as string}</strong></p>
            <a href="/bookings" style={{ color: "var(--gold)" }}>متابعة حالة الحجز والتذكرة ←</a>
          </div>
        )}
      </section>
    </main>
  );
}
