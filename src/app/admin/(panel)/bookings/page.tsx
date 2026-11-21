import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { demoBookings } from "@/lib/demo";
import BookingReviewActions from "./BookingReviewActions";
import AdminPageHeader from "../AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function AdminBookings() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");
  if (!isMongoConfigured()) return (
    <main className="container admin-page">
      <AdminPageHeader eyebrow="سجل الحضور" title="الحجوزات والدفع" description="راجع طلبات الحجز، وافحص إثبات التحويل، واعتمد إصدار التذاكر." />
      <div className="admin-booking-list">
        {demoBookings.map((booking) => (
          <article className="card admin-booking-card" key={booking.id}>
            <strong>{booking.fullName}</strong><span style={{ float: "left", color: "var(--gold)" }}>{booking.id}</span>
            <p>{booking.mobile} | {booking.quantity} تذاكر | {booking.totalAmount.toLocaleString("ar")} د.ع</p>
            <p>الحالة: <b>{booking.status}</b></p>
            {booking.status === "PENDING_REVIEW" && <button className="btn" type="button">اعتماد الدفع التجريبي</button>}
          </article>
        ))}
      </div>
    </main>
  );
  const db = await getDb();
  const bookings = await db.collection("bookings").find().sort({ createdAt: -1 }).limit(100).toArray();
  const bookingIds = bookings.map((booking) => booking._id);
  const payments = bookingIds.length
    ? await db.collection("payments").find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 }).toArray()
    : [];
  const latestPayment = new Map<string, (typeof payments)[number]>();
  for (const payment of payments) {
    const key = String(payment.bookingId);
    if (!latestPayment.has(key)) latestPayment.set(key, payment);
  }
  return (
    <main className="container admin-page">
      <AdminPageHeader eyebrow="سجل الحضور" title="الحجوزات والدفع" description="راجع طلبات الحجز، وافحص إثبات التحويل، واعتمد إصدار التذاكر." />
      <div className="admin-booking-list">
        {bookings.map((booking) => (
          <article className="card admin-booking-card" key={booking._id.toString()}>
            <strong>{booking.fullName as string}</strong>
            <p>{String(booking.showSnapshot?.title || "العرض")} · {String(booking.showSnapshot?.date || "")} · {String(booking.showSnapshot?.time || "")}</p>
            <p>{booking.mobile as string} | {String(booking.quantity)} تذاكر | {Number(booking.totalAmount).toLocaleString("ar")} د.ع</p>
            <p>الحالة: <b>{booking.status as string}</b></p>
            {latestPayment.get(booking._id.toString())?.screenshotFileId && (
              <>
                <p>
                  طريقة التحويل: <b>{latestPayment.get(booking._id.toString())?.paymentMethod === "INSTAPAY" ? "Instapay" : "محفظة كاش"}</b>
                </p>
                <a className="admin-payment-proof" href={`/api/files/${String(latestPayment.get(booking._id.toString())?.screenshotFileId)}`} target="_blank" rel="noreferrer">
                  <span>عرض إثبات التحويل</span>
                  <img src={`/api/files/${String(latestPayment.get(booking._id.toString())?.screenshotFileId)}`} alt={`إثبات التحويل للضيف ${String(booking.fullName)}`} />
                </a>
              </>
            )}
            {["PENDING_REVIEW", "APPROVED"].includes(booking.status) && (
              <BookingReviewActions bookingId={booking._id.toString()} approved={booking.status === "APPROVED"} />
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
