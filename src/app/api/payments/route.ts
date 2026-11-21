import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { uploadFile } from "@/lib/gridfs";

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
  const fileId = await uploadFile(new Uint8Array(await file.arrayBuffer()), file.name, file.type, {
    purpose: "payment-screenshot",
    bookingId,
    private: true,
  });
  await db.collection("payments").insertOne({
    bookingId: booking._id,
    screenshotFileId: fileId,
    paymentMethod,
    status: "PENDING_REVIEW",
    createdAt: new Date(),
  });
  await db.collection("bookings").updateOne(
    { _id: booking._id },
    { $set: { status: "PENDING_REVIEW", updatedAt: new Date() } },
  );
  return NextResponse.redirect(new URL(`/payment/${bookingId}?submitted=1`, request.url));
}
