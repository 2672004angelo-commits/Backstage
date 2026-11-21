import { NextRequest, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { bookingSchema } from "@/lib/validation";
import { ObjectId } from "mongodb";
import { getShowPerformances } from "@/lib/show-performances";
import { nextBookingNumber } from "@/lib/booking-number";
import { bookingContactQuery, performanceBookingQuery } from "@/lib/booking-lookup";
import { parsePushSubscription, pushSubscriptionKey } from "@/lib/push-subscription";
import { isWebPushConfigured } from "@/lib/web-push";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  if (
    !isWebPushConfigured()
    || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== process.env.VAPID_PUBLIC_KEY
  ) {
    return NextResponse.json({ error: "PUSH_NOT_CONFIGURED" }, { status: 503 });
  }
  const contentType = request.headers.get("content-type") || "";
  let data: Record<string, unknown>;
  if (contentType.includes("application/json")) {
    try { data = await request.json(); }
    catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  } else {
    const form = await request.formData();
    data = Object.fromEntries(form.entries());
  }
  if (data.notificationConsent !== true) {
    return NextResponse.json({ error: "PUSH_CONSENT_REQUIRED" }, { status: 400 });
  }
  const pushSubscription = parsePushSubscription(data.pushSubscription);
  if (!pushSubscription) {
    return NextResponse.json({ error: "PUSH_SUBSCRIPTION_REQUIRED" }, { status: 400 });
  }
  data.quantity = Number(data.quantity);
  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDb();
  const show = await db.collection("shows").findOne({ _id: new ObjectId(parsed.data.showId) });
  if (!show || !show.open) return NextResponse.json({ error: "SHOW_UNAVAILABLE" }, { status: 409 });
  const performances = getShowPerformances(show);
  const availablePerformances = performances.filter((performance) => performance.open);
  const performance = parsed.data.performanceId
    ? performances.find((item) => item.id === parsed.data.performanceId)
    : availablePerformances.length === 1 ? availablePerformances[0] : undefined;
  if (!performance || !performance.open) {
    return NextResponse.json({
      error: parsed.data.performanceId ? "PERFORMANCE_UNAVAILABLE" : "PERFORMANCE_REQUIRED",
    }, { status: parsed.data.performanceId ? 409 : 400 });
  }

  const mobile = parsed.data.mobile.replace(/^\+/, "");
  const email = parsed.data.email ? parsed.data.email.trim().toLowerCase() : null;
  const showObjectId = new ObjectId(parsed.data.showId);
  const existingBooking = await db.collection("bookings").findOne({
    showId: showObjectId,
    $and: [
      { $or: performanceBookingQuery(performance) },
      { $or: bookingContactQuery(mobile, email) },
    ],
  });
  if (existingBooking) return NextResponse.json({ error: "BOOKING_ALREADY_EXISTS" }, { status: 409 });

  const activeStatuses = ["PENDING_PAYMENT", "PENDING_REVIEW", "APPROVED"];
  const sold = await db.collection("bookings").aggregate([
    {
      $match: {
        showId: showObjectId,
        status: { $in: activeStatuses },
        $or: performanceBookingQuery(performance),
      },
    },
    { $group: { _id: null, quantity: { $sum: "$quantity" } } },
  ]).next();
  if ((sold?.quantity || 0) + parsed.data.quantity > Number(show.capacity)) {
    return NextResponse.json({ error: "NOT_ENOUGH_CAPACITY" }, { status: 409 });
  }

  let insertedId: ObjectId;
  const bookingNumber = await nextBookingNumber(db);
  try {
    const result = await db.collection("bookings").insertOne({
      bookingNumber,
      showId: showObjectId,
      performanceId: performance.id,
      showSnapshot: {
        title: show.title,
        performanceId: performance.id,
        date: performance.date,
        time: performance.time,
        venue: show.venue,
      },
      fullName: parsed.data.fullName,
      mobile,
      mobileNormalized: mobile,
      email,
      emailNormalized: email,
      quantity: parsed.data.quantity,
      unitPrice: Number(show.price),
      totalAmount: Number(show.price) * parsed.data.quantity,
      currency: "IQD",
      status: "PENDING_PAYMENT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    insertedId = result.insertedId;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "BOOKING_ALREADY_EXISTS" }, { status: 409 });
    }
    throw error;
  }
  const subscriptionKey = pushSubscriptionKey(mobile, email || "", pushSubscription.endpoint);
  try {
    await db.collection("pushSubscriptions").updateOne(
      { subscriptionKey },
      {
        $set: {
          mobile,
          subscriptionKey,
          endpoint: pushSubscription.endpoint,
          subscription: pushSubscription,
          updatedAt: new Date(),
        },
        $addToSet: { bookingIds: insertedId.toString() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  } catch (error) {
    console.error("BOOKING_PUSH_SUBSCRIBE_FAILED", error instanceof Error ? error.name : "UnknownError");
    try {
      const cleanup = await db.collection("bookings").deleteOne({ _id: insertedId, status: "PENDING_PAYMENT" });
      if (!cleanup.deletedCount) console.error("BOOKING_CLEANUP_MISSED_AFTER_PUSH_ERROR", insertedId.toString());
    } catch (cleanupError) {
      console.error("FAILED_BOOKING_CLEANUP_AFTER_PUSH_ERROR", cleanupError instanceof Error ? cleanupError.name : "UnknownError");
    }
    return NextResponse.json({ error: "PUSH_SUBSCRIPTION_FAILED" }, { status: 503 });
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return NextResponse.redirect(new URL(`/payment/${insertedId}`, request.url));
  }
  return NextResponse.json({ id: insertedId }, { status: 201 });
}
