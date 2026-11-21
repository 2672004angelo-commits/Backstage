import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ ok: true, demo: true });
  let body: Record<string, unknown>;
  try {
    const json: unknown = await request.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    body = json as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const mobile = typeof body.mobile === "string" ? body.mobile.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const subscription = body.subscription;
  if (
    !subscription ||
    typeof subscription !== "object" ||
    !("endpoint" in subscription) ||
    typeof subscription.endpoint !== "string" ||
    !subscription.endpoint.startsWith("https://") ||
    !("keys" in subscription) ||
    !subscription.keys ||
    typeof subscription.keys !== "object" ||
    !("p256dh" in subscription.keys) ||
    typeof subscription.keys.p256dh !== "string" ||
    !("auth" in subscription.keys) ||
    typeof subscription.keys.auth !== "string"
  ) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  if (bookingId && !ObjectId.isValid(bookingId)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const db = await getDb();
  if (bookingId) {
    const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
    if (!booking) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 403 });
    const normalizedMobile = String(booking.mobileNormalized || booking.mobile || "").replace(/^\+/, "");
    const subscriptionKey = `${normalizedMobile || email}:${subscription.endpoint}`;
    await db.collection("pushSubscriptions").updateOne(
      { subscriptionKey },
      {
        $set: { mobile: normalizedMobile, subscriptionKey, endpoint: subscription.endpoint, subscription, updatedAt: new Date() },
        $addToSet: { bookingIds: bookingId },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  }
  const normalizedMobile = mobile.replace(/^\+/, "");
  if (!/^[0-9]{8,15}$/.test(normalizedMobile) && !email) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const bookings = await db.collection("bookings").find({
    $or: [
      ...(normalizedMobile ? [
        { mobileNormalized: normalizedMobile },
        { mobile: { $in: [normalizedMobile, `+${normalizedMobile}`] } },
      ] : []),
      ...(email ? [
        { emailNormalized: email },
        { email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      ] : []),
    ],
  }).limit(50).toArray();
  if (!bookings.length) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 403 });
  }
  const bookingIds = bookings.map((booking) => booking._id.toString());
  const subscriptionKey = `${normalizedMobile || email}:${subscription.endpoint}`;
  await db.collection("pushSubscriptions").updateOne(
    { subscriptionKey },
    {
      $set: {
        mobile: normalizedMobile || null,
        subscriptionKey,
        endpoint: subscription.endpoint,
        subscription,
        updatedAt: new Date(),
      },
      $addToSet: { bookingIds: { $each: bookingIds } },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
