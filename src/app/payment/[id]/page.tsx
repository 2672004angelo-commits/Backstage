import type { Metadata } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { demoShows } from "@/lib/demo";
import PaymentUploadForm from "./PaymentUploadForm";
import LanguageToggle from "../../LanguageToggle";
import { displayBookingNumber } from "@/lib/booking-number";
import { formatPerformanceTime } from "@/lib/show-performances";

function PaymentInstructions() {
  return (
    <section className="card payment-instructions" aria-labelledby="payment-instructions-title">
      <h2 id="payment-instructions-title">حوّل المبلغ إلى أحد الرقمين التاليين</h2>
      <div className="payment-instructions-grid">
        <div className="payment-instructions-account">
          <span>Instapay</span>
          <strong dir="ltr">01273176278</strong>
        </div>
        <div className="payment-instructions-account">
          <span>محفظة كاش</span>
          <strong dir="ltr">01229212293</strong>
        </div>
      </div>
      <p>اختر طريقة التحويل المناسبة، ثم ارفع صورة واضحة لإثبات الدفع.</p>
    </section>
  );
}

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
      <main className="public-ambient-page">
        <div className="public-ambient-content">
        <div className="public-page-locale"><LanguageToggle /></div>
        <h1 className="public-transaction-title">الدفع اليدوي</h1>
        <section className="card public-transaction-card">
          <p>عرض تجريبي: <strong>{demo.title}</strong></p>
          <p>المبلغ المستحق: <strong className="public-payment-amount">{demo.price.toLocaleString("ar")} جنيه</strong></p>
          <PaymentInstructions />
          {submitted ? (
            <section className="public-payment-confirmation">
              <h2>تم رفع إثبات الدفع بنجاح</h2><p>حجزك في وضع الانتظار للمراجعة.</p>
            </section>
          ) : (
            <form action={`/payment/${id}?submitted=1`} method="get" className="public-payment-form">
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
        </div>
      </main>
    );
  }
  const db = await getDb();
  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(id) });
  if (!booking) {
    const demo = demoShows.find((item) => item._id === id);
    if (!demo) notFound();
    return (
      <main className="public-ambient-page">
        <div className="public-ambient-content">
        <div className="public-page-locale"><LanguageToggle /></div>
        <h1 className="public-transaction-title">الدفع اليدوي</h1>
        <section className="card public-transaction-card">
          <p>عرض تجريبي: <strong>{demo.title}</strong></p>
          <p>المبلغ المستحق: <strong className="public-payment-amount">{demo.price.toLocaleString("ar")} جنيه</strong></p>
          <PaymentInstructions />
          {submitted ? (
            <section className="public-payment-confirmation">
              <h2>تم رفع إثبات الدفع بنجاح</h2><p>حجزك في وضع الانتظار للمراجعة.</p>
            </section>
          ) : (
            <form action={`/payment/${id}?submitted=1`} method="get" className="public-payment-form">
              <label>صورة إثبات الدفع (عرض تجريبي)<input className="field" type="file" accept="image/jpeg,image/png,image/webp" /></label>
              <button className="btn" type="submit">رفع إثبات الدفع التجريبي</button>
            </form>
          )}
        </section>
        </div>
      </main>
    );
  }
  return (
    <main className="public-ambient-page">
      <div className="public-ambient-content">
      <div className="public-page-locale"><LanguageToggle /></div>
      <h1 className="public-transaction-title">الدفع اليدوي</h1>
      {submitted ? (
        <section className="card public-payment-confirmation">
          <h2>تم رفع إثبات الدفع</h2>
          <p>حجزك بانتظار مراجعة الإدارة. لن يتم إصدار التذاكر قبل الموافقة على الدفع.</p>
          <a className="btn" href="/bookings">تابع حالة الحجز والتذكرة</a>
        </section>
      ) : null}
      <section className="card public-transaction-card">
        <div className="public-payment-summary">
          <p><span>رقم الحجز</span><strong><code dir="ltr">{displayBookingNumber(id, booking.bookingNumber)}</code></strong></p>
          <p><span>موعد العرض</span><strong>{String(booking.showSnapshot?.date || "")} · {formatPerformanceTime(String(booking.showSnapshot?.time || ""))}</strong></p>
          <p><span>المبلغ المستحق</span><strong className="public-payment-amount">{Number(booking.totalAmount).toLocaleString("ar")} جنيه</strong></p>
        </div>
        {["PENDING_PAYMENT", "REJECTED"].includes(booking.status) ? (
          <>
            <PaymentInstructions />
            <PaymentUploadForm bookingId={id} />
          </>
        ) : (
          <div className="public-payment-status">
            <p>حالة الحجز: <strong>{booking.status as string}</strong></p>
            <a href="/bookings">متابعة حالة الحجز والتذكرة ←</a>
          </div>
        )}
      </section>
      </div>
    </main>
  );
}
