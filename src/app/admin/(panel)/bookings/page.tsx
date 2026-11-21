import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { demoBookings } from "@/lib/demo";
import BookingReviewActions from "./BookingReviewActions";
import AdminBookingActions from "./AdminBookingActions";
import PaymentRecordActions from "./PaymentRecordActions";
import AdminPageHeader from "../AdminPageHeader";
import { getShowPerformances } from "@/lib/show-performances";

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
            <p>{booking.mobile} | {booking.quantity} تذاكر | {booking.totalAmount.toLocaleString("ar")} جنيه</p>
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
  const showIds = [...new Map(bookings.map((booking) => [String(booking.showId), booking.showId])).values()];
  const shows = showIds.length
    ? await db.collection("shows").find({ _id: { $in: showIds } }).toArray()
    : [];
  const performancesByShow = new Map(shows.map((show) => [
    show._id.toString(),
    getShowPerformances(show),
  ]));
  const payments = bookingIds.length
    ? await db.collection("payments").find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 }).toArray()
    : [];
  const paymentsByBooking = new Map<string, (typeof payments)>();
  for (const payment of payments) {
    const key = String(payment.bookingId);
    const records = paymentsByBooking.get(key) || [];
    records.push(payment);
    paymentsByBooking.set(key, records);
  }
  return (
    <main className="container admin-page">
      <AdminPageHeader eyebrow="سجل الحضور" title="الحجوزات والدفع" description="راجع طلبات الحجز، وافحص إثبات التحويل، واعتمد إصدار التذاكر." />
      <div className="admin-booking-list">
        {bookings.map((booking) => (
          <article className="card admin-booking-card" key={booking._id.toString()}>
            <strong>{booking.fullName as string}</strong>
            <p>{String(booking.showSnapshot?.title || "العرض")} · {String(booking.showSnapshot?.date || "")} · {String(booking.showSnapshot?.time || "")}</p>
            <p>{booking.mobile as string} | {String(booking.quantity)} تذاكر | {Number(booking.totalAmount).toLocaleString("ar")} جنيه</p>
            <p>الحالة: <b>{booking.status as string}</b></p>
            {paymentsByBooking.get(booking._id.toString())?.map((payment, index, records) => (
              <section className="admin-payment-record" key={payment._id.toString()}>
                <p>إثبات الدفع {records.length > 1 ? `(${records.length - index})` : ""} · الحالة: <b>{String(payment.status || "")}</b></p>
                {payment.screenshotFileId && (
                  <a className="admin-payment-proof" href={`/api/files/${String(payment.screenshotFileId)}`} target="_blank" rel="noreferrer">
                    <span>عرض إثبات التحويل</span>
                    <img src={`/api/files/${String(payment.screenshotFileId)}`} alt={`إثبات التحويل للضيف ${String(booking.fullName)}`} />
                  </a>
                )}
                <PaymentRecordActions
                  bookingId={booking._id.toString()}
                  paymentId={payment._id.toString()}
                  paymentMethod={String(payment.paymentMethod || "INSTAPAY")}
                  isLatest={index === 0}
                  editable={booking.status !== "APPROVED"}
                />
              </section>
            ))}
            {["PENDING_REVIEW", "APPROVED"].includes(booking.status) && (
              <BookingReviewActions bookingId={booking._id.toString()} approved={booking.status === "APPROVED"} />
            )}
            <AdminBookingActions
              bookingId={booking._id.toString()}
              fullName={String(booking.fullName || "")}
              mobile={String(booking.mobile || "")}
              email={String(booking.email || "")}
              performanceId={String(booking.performanceId || booking.showSnapshot?.performanceId || "")}
              performances={performancesByShow.get(String(booking.showId)) || []}
              canEdit={booking.status !== "APPROVED"}
            />
          </article>
        ))}
      </div>
    </main>
  );
}
