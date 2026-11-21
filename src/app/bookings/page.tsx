import type { Metadata } from "next";
import { isMongoConfigured } from "@/lib/mongodb";
import { demoBookings } from "@/lib/demo";
import BookingSearch from "./BookingSearch";
import LanguageToggle from "../LanguageToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "حجوزاتي",
  description: "تابع حالة حجزك واعرض تذكرتك بعد اعتماد الدفع.",
  robots: { index: false, follow: false },
};

export default async function MyBookings() {
  if (!isMongoConfigured()) {
    return (
      <main className="public-ambient-page">
        <div className="public-ambient-content">
          <div className="public-page-locale"><LanguageToggle /></div>
          <h1 className="public-transaction-title">حجوزاتي</h1>
          <p className="public-transaction-intro">أدخل رقم الهاتف المستخدم عند الحجز للعثور على حجوزاتك وتذاكرك بعد اعتماد الدفع.</p>
          <div className="public-booking-list">
            {demoBookings.map((booking) => (
            <article className="card public-booking-summary" key={booking.id}>
              <div className="public-booking-summary-head">
                <strong>{booking.show}</strong><span>{booking.id}</span>
              </div>
              <p>{booking.fullName} · {booking.quantity} تذاكر · {booking.totalAmount.toLocaleString("ar")} جنيه</p>
              <p>الحالة: <strong>{booking.status}</strong></p>
            </article>
          ))}
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="public-ambient-page">
      <div className="public-ambient-content">
        <div className="public-page-locale"><LanguageToggle /></div>
        <h1 className="public-transaction-title">حجوزاتي</h1>
        <BookingSearch />
      </div>
    </main>
  );
}
