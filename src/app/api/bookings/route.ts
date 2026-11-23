import { NextRequest, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { bookingSchema } from "@/lib/validation";
import { mongoPromise } from "@/lib/mongodb";
import { withPerformanceLock, performanceLockId, soldQuantityForPerformance, BookingConflict } from "@/lib/capacity";
import { sendAdminPush } from "@/lib/web-push";
import { ObjectId } from "mongodb";
import { getShowPerformances } from "@/lib/show-performances";
import { nextBookingNumber } from "@/lib/booking-number";
import { bookingContactQuery, performanceBookingQuery } from "@/lib/booking-lookup";
import { parsePushSubscription, pushSubscriptionKey } from "@/lib/push-subscription";
import { uploadFile, deleteFile } from "@/lib/gridfs";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const contentType = request.headers.get("content-type") || "";
  // Payment proof is a file upload: a booking cannot be created without it, so
  // only multipart requests (which can carry the file) are accepted at all.
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "PROOF_REQUIRED" }, { status: 400 });
  }
  const form = await request.formData();
  const data: Record<string, unknown> = Object.fromEntries(form.entries());
  const proofFile = form.get("screenshot");
  const paymentMethod = String(form.get("paymentMethod") || "");
  if (!(proofFile instanceof File) || !proofFile.size) {
    return NextResponse.json({ error: "PROOF_REQUIRED" }, { status: 400 });
  }
  if (!["INSTAPAY", "CASH_WALLET"].includes(paymentMethod)) {
    return NextResponse.json({ error: "INVALID_PAYMENT_METHOD" }, { status: 400 });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(proofFile.type) || proofFile.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
  }
  let pushSubscriptionRaw: unknown = data.pushSubscription;
  if (typeof pushSubscriptionRaw === "string" && pushSubscriptionRaw) {
    try { pushSubscriptionRaw = JSON.parse(pushSubscriptionRaw); } catch { pushSubscriptionRaw = null; }
  }
  const pushSubscription = parsePushSubscription(pushSubscriptionRaw);
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
  const client = await mongoPromise();
  const lockId = performanceLockId(showObjectId.toHexString(), performance.id);
  const bookingNumber = await nextBookingNumber(db);

  // Upload the proof before entering the lock; removed again if the seat claim fails.
  const proofFileId = await uploadFile(new Uint8Array(await proofFile.arrayBuffer()), proofFile.name, proofFile.type, {
    purpose: "payment-screenshot",
    bookingId: "pending",
    private: true,
  });

  let insertedId: ObjectId;
  try {
    insertedId = await withPerformanceLock(client, db, lockId, async (session) => {
      const existingBooking = await db.collection("bookings").findOne({
        showId: showObjectId,
        $and: [
          { $or: performanceBookingQuery(performance) },
          { $or: bookingContactQuery(mobile, email) },
        ],
      }, { session });
      if (existingBooking) throw new BookingConflict("BOOKING_ALREADY_EXISTS");
      const soldQuantity = await soldQuantityForPerformance(db, showObjectId, performance, session);
      if (soldQuantity + parsed.data.quantity > Number(show.capacity)) {
        throw new BookingConflict("NOT_ENOUGH_CAPACITY");
      }
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
        currency: "EGP",
        status: "PENDING_REVIEW",
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { session });
      await db.collection("payments").insertOne({
        bookingId: result.insertedId,
        screenshotFileId: proofFileId,
        paymentMethod,
        status: "PENDING_REVIEW",
        createdAt: new Date(),
      }, { session });
      return result.insertedId;
    });
  } catch (error) {
    if (error instanceof BookingConflict) {
      await deleteFile(proofFileId).catch(() => undefined);
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      await deleteFile(proofFileId).catch(() => undefined);
      return NextResponse.json({ error: "BOOKING_ALREADY_EXISTS" }, { status: 409 });
    }
    await deleteFile(proofFileId).catch(() => undefined);
    throw error;
  }

  try {
    await db.collection("uploads.files").updateOne(
      { _id: proofFileId },
      { $set: { "metadata.bookingId": insertedId.toString() } },
    );
  } catch (error) {
    console.error("PROOF_FILE_BOOKING_LINK_FAILED_OPTIONAL", error instanceof Error ? error.name : "UnknownError");
  }

  try {
    await sendAdminPush(db, {
      title: "حجز جديد",
      body: `${parsed.data.fullName} - ${show.title} - ${performance.date} ${performance.time}`,
      url: "/admin/bookings",
    });
  } catch (error) {
    console.error("ADMIN_PUSH_FAILED_OPTIONAL", error instanceof Error ? error.name : "UnknownError");
  }
  if (pushSubscription) {
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
      console.error("BOOKING_PUSH_SUBSCRIBE_FAILED_OPTIONAL", error instanceof Error ? error.name : "UnknownError");
    }
  }
  return NextResponse.json({ id: insertedId }, { status: 201 });
}
