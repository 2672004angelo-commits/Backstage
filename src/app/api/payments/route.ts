import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured, mongoPromise } from "@/lib/mongodb";
import { uploadFile, deleteFile } from "@/lib/gridfs";
import { getShowPerformances } from "@/lib/show-performances";
import { withPerformanceLock, performanceLockId, soldQuantityForPerformance, BookingConflict } from "@/lib/capacity";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const form = await request.formData();
  const bookingId = String(form.get("bookingId") || "");
  const file = form.get("screenshot");
  const paymentMethod = String(form.get("paymentMethod") || "");
  if (!ObjectId.isValid(bookingId) || !(file instanceof File)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!["INSTAPAY", "CASH_WALLET"].includes(paymentMethod)) {
    return NextResponse.json({ error: "INVALID_PAYMENT_METHOD" }, { status: 400 });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
  }
  const db = await getDb();
  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking || !["PENDING_PAYMENT", "REJECTED"].includes(booking.status)) {
    return NextResponse.json({ error: "BOOKING_NOT_PAYABLE" }, { status: 409 });
  }
  const showId = new ObjectId(String(booking.showId));
  const show = await db.collection("shows").findOne({ _id: showId });
  if (!show) return NextResponse.json({ error: "SHOW_UNAVAILABLE" }, { status: 409 });
  const performances = getShowPerformances(show);
  const performance = performances.find((item) => item.id === booking.performanceId)
    || (performances.length === 1 ? performances[0] : undefined);
  if (!performance) return NextResponse.json({ error: "PERFORMANCE_UNAVAILABLE" }, { status: 409 });

  const fileId = await uploadFile(new Uint8Array(await file.arrayBuffer()), file.name, file.type, {
    purpose: "payment-screenshot",
    bookingId,
    private: true,
  });

  // The seat is claimed here, at proof upload: capacity is re-checked inside the
  // performance lock so two guests can never take the last seat simultaneously.
  const client = await mongoPromise();
  try {
    await withPerformanceLock(client, db, performanceLockId(showId.toHexString(), performance.id), async (session) => {
      const liveBooking = await db.collection("bookings").findOne({ _id: booking._id }, { session });
      if (!liveBooking || !["PENDING_PAYMENT", "REJECTED"].includes(liveBooking.status)) {
        throw new BookingConflict("BOOKING_NOT_PAYABLE");
      }
      const soldQuantity = await soldQuantityForPerformance(db, showId, performance, session);
      if (soldQuantity + Number(liveBooking.quantity) > Number(show.capacity)) {
        throw new BookingConflict("NOT_ENOUGH_CAPACITY");
      }
      await db.collection("payments").insertOne({
        bookingId: booking._id,
        screenshotFileId: fileId,
        paymentMethod,
        status: "PENDING_REVIEW",
        createdAt: new Date(),
      }, { session });
      await db.collection("bookings").updateOne(
        { _id: booking._id },
        { $set: { status: "PENDING_REVIEW", updatedAt: new Date() } },
        { session },
      );
    });
  } catch (error) {
    if (error instanceof BookingConflict) {
      await deleteFile(fileId).catch(() => undefined);
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true, bookingId });
}
