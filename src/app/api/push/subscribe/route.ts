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
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const db = await getDb();
  const normalizedMobile = mobile.replace(/^\+/, "");
  const bookings = await db.collection("bookings").find({
    $or: [
      { mobileNormalized: normalizedMobile },
      { mobile: { $in: [normalizedMobile, `+${normalizedMobile}`] } },
    ],
  }).limit(50).toArray();
  if (!bookings.length) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 403 });
  }
  const bookingIds = bookings.map((booking) => booking._id.toString());
  const subscriptionKey = `${normalizedMobile}:${subscription.endpoint}`;
  await db.collection("pushSubscriptions").updateOne(
    { subscriptionKey },
    {
      $set: {
        bookingIds,
        mobile: normalizedMobile,
        subscriptionKey,
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
