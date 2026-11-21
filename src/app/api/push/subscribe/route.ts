import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ ok: true, demo: true });
  const body = await request.json();
  const bookingId = String(body.bookingId || "");
  const mobile = String(body.mobile || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const subscription = body.subscription;
  if (!ObjectId.isValid(bookingId) || !subscription?.endpoint) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const db = await getDb();
  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking || booking.mobile !== mobile || (email && booking.email?.toLowerCase() !== email)) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 403 });
  }
  await db.collection("pushSubscriptions").updateOne(
    { bookingId, endpoint: subscription.endpoint },
    {
      $set: {
        bookingId,
        endpoint: subscription.endpoint,
        subscription,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
