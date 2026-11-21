import { NextRequest, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { bookingSchema } from "@/lib/validation";
import { ObjectId } from "mongodb";
import { getShowPerformances } from "@/lib/show-performances";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const contentType = request.headers.get("content-type") || "";
  let data: Record<string, unknown>;
  if (contentType.includes("application/json")) {
    try { data = await request.json(); }
    catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  } else {
    const form = await request.formData();
    data = Object.fromEntries(form.entries());
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
  const contactQuery = [
    { mobileNormalized: mobile },
    { mobile: { $in: [mobile, `+${mobile}`] } },
    ...(email ? [
      { emailNormalized: email },
      { email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
    ] : []),
  ];
  const showObjectId = new ObjectId(parsed.data.showId);
  const performanceQuery = [
    { performanceId: performance.id },
    {
      performanceId: { $exists: false },
      "showSnapshot.date": performance.date,
      "showSnapshot.time": performance.time,
    },
  ];
  const existingBooking = await db.collection("bookings").findOne({
    showId: showObjectId,
    $and: [
      { $or: performanceQuery },
      { $or: contactQuery },
    ],
  });
  if (existingBooking) return NextResponse.json({ error: "BOOKING_ALREADY_EXISTS" }, { status: 409 });

  const activeStatuses = ["PENDING_PAYMENT", "PENDING_REVIEW", "APPROVED"];
  const sold = await db.collection("bookings").aggregate([
    {
      $match: {
        showId: showObjectId,
        status: { $in: activeStatuses },
        $or: performanceQuery,
      },
    },
    { $group: { _id: null, quantity: { $sum: "$quantity" } } },
  ]).next();
  if ((sold?.quantity || 0) + parsed.data.quantity > Number(show.capacity)) {
    return NextResponse.json({ error: "NOT_ENOUGH_CAPACITY" }, { status: 409 });
  }

  let insertedId: ObjectId;
  try {
    const result = await db.collection("bookings").insertOne({
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
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return NextResponse.redirect(new URL(`/payment/${insertedId}`, request.url));
  }
  return NextResponse.json({ id: insertedId }, { status: 201 });
}
