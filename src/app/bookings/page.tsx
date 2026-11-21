import type { Metadata } from "next";
import { isMongoConfigured } from "@/lib/mongodb";
import { demoBookings } from "@/lib/demo";
import BookingSearch from "./BookingSearch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "حجوزاتي",
  description: "تابع حالة حجزك واعرض تذكرتك بعد اعتماد الدفع.",
  robots: { index: false, follow: false },
};

export default async function MyBookings() {
  if (!isMongoConfigured()) {
    return (
      <main className="container" style={{ maxWidth: 760, padding: "48px 0" }}>
        <h1>حجوزاتي</h1>
        <p style={{ color: "#aaa" }}>أدخل رقم الحجز ورقم الهاتف للعثور على التذكرة بعد اعتماد الدفع.</p>
        <div style={{ display: "grid", gap: 12 }}>
          {demoBookings.map((booking) => (
            <article className="card" key={booking.id} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{booking.show}</strong><span style={{ color: "var(--gold)" }}>{booking.id}</span>
              </div>
              <p>{booking.fullName} · {booking.quantity} تذاكر · {booking.totalAmount.toLocaleString("ar")} د.ع</p>
              <p>الحالة: <strong>{booking.status}</strong></p>
            </article>
          ))}
        </div>
      </main>
    );
  }
  return (
    <main className="container" style={{ maxWidth: 760, padding: "48px 0" }}>
      <h1>حجوزاتي</h1>
      <BookingSearch />
    </main>
  );
}
