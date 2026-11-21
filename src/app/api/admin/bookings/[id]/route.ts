import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured, mongoPromise } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { bookingSchema } from "@/lib/validation";
import { getShowPerformances } from "@/lib/show-performances";
import { bookingContactQuery, performanceBookingQuery } from "@/lib/booking-lookup";
import { deleteFile } from "@/lib/gridfs";

type RouteContext = { params: Promise<{ id: string }> };

async function authorize() {
  try {
    return await requireRole(["admin"]);
  } catch {
    return null;
  }
}

async function parseBody(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

  const db = await getDb();
  const bookings = db.collection("bookings");
  const bookingId = new ObjectId(id);
  const booking = await bookings.findOne({ _id: bookingId });
  if (!booking) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (booking.status === "APPROVED" || await db.collection("tickets").countDocuments({ bookingId }) > 0) {
    return NextResponse.json({ error: "BOOKING_HAS_ISSUED_TICKETS" }, { status: 409 });
  }
  if (!ObjectId.isValid(String(booking.showId))) {
    return NextResponse.json({ error: "SHOW_UNAVAILABLE" }, { status: 409 });
  }

  const showId = new ObjectId(String(booking.showId));
  const show = await db.collection("shows").findOne({ _id: showId });
  if (!show) return NextResponse.json({ error: "SHOW_UNAVAILABLE" }, { status: 409 });
  const parsed = bookingSchema.safeParse({
    showId: showId.toString(),
    performanceId: body.performanceId,
    fullName: body.fullName,
    mobile: body.mobile,
    email: body.email,
    quantity: Number(booking.quantity),
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const performances = getShowPerformances(show);
  const performance = performances.find((item) => item.id === parsed.data.performanceId);
  if (!performance || (!performance.open && performance.id !== booking.performanceId)) {
    return NextResponse.json({ error: "PERFORMANCE_UNAVAILABLE" }, { status: 409 });
  }

  const mobile = parsed.data.mobile.replace(/^\+/, "");
  const email = parsed.data.email ? parsed.data.email.trim().toLowerCase() : null;
  const duplicate = await bookings.findOne({
    showId,
    _id: { $ne: bookingId },
    $and: [
      { $or: performanceBookingQuery(performance) },
      { $or: bookingContactQuery(mobile, email) },
    ],
  });
  if (duplicate) return NextResponse.json({ error: "BOOKING_ALREADY_EXISTS" }, { status: 409 });

  if (performance.id !== booking.performanceId) {
    const activeStatuses = ["PENDING_PAYMENT", "PENDING_REVIEW", "APPROVED"];
    const sold = await bookings.aggregate([
      {
        $match: {
          _id: { $ne: bookingId },
          showId,
          status: { $in: activeStatuses },
          $or: performanceBookingQuery(performance),
        },
      },
      { $group: { _id: null, quantity: { $sum: "$quantity" } } },
    ]).next();
    if ((sold?.quantity || 0) + Number(booking.quantity) > Number(show.capacity)) {
      return NextResponse.json({ error: "NOT_ENOUGH_CAPACITY" }, { status: 409 });
    }
  }

  await bookings.updateOne({ _id: bookingId }, {
    $set: {
      fullName: parsed.data.fullName,
      mobile,
      mobileNormalized: mobile,
      email,
      emailNormalized: email,
      performanceId: performance.id,
      showSnapshot: {
        title: show.title,
        performanceId: performance.id,
        date: performance.date,
        time: performance.time,
        venue: show.venue,
      },
      updatedAt: new Date(),
    },
  });
  await db.collection("auditLogs").insertOne({
    action: "BOOKING_UPDATED",
    bookingId,
    actor: session.id,
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const db = await getDb();
  const bookingId = new ObjectId(id);
  const booking = await db.collection("bookings").findOne({ _id: bookingId });
  if (!booking) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const tickets = await db.collection("tickets").find({ bookingId }).toArray();
  if (tickets.some((ticket) => ticket.checkedIn)) {
    return NextResponse.json({ error: "BOOKING_HAS_USED_TICKETS" }, { status: 409 });
  }
  const payments = await db.collection("payments").find({ bookingId }).toArray();
  const fileIds = [
    ...tickets.map((ticket) => ticket.ticketImageFileId),
    ...payments.map((payment) => payment.screenshotFileId),
  ].filter(Boolean).map((value) => String(value));
  if (fileIds.some((fileId) => !ObjectId.isValid(fileId))) {
    return NextResponse.json({ error: "INVALID_FILE_REFERENCE" }, { status: 409 });
  }
  const ticketIds = tickets.map((ticket) => ticket._id);
  const client = await mongoPromise();
  const dbSession = client.startSession();
  try {
    await dbSession.withTransaction(async () => {
      if (ticketIds.length) {
        await db.collection("checkins").deleteMany({ ticketId: { $in: ticketIds } }, { session: dbSession });
        await db.collection("tickets").deleteMany({ bookingId }, { session: dbSession });
      }
      await db.collection("payments").deleteMany({ bookingId }, { session: dbSession });
      await db.collection<{ bookingIds: string[] }>("pushSubscriptions").updateMany(
        { bookingIds: id },
        { $pull: { bookingIds: id } },
        { session: dbSession },
      );
      await db.collection("bookings").deleteOne({ _id: bookingId }, { session: dbSession });
      await db.collection("auditLogs").insertOne({
        action: "BOOKING_DELETED",
        bookingId,
        actor: session.id,
        createdAt: new Date(),
      }, { session: dbSession });
    });
  } catch (error) {
    console.error("BOOKING_DELETE_FAILED", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "BOOKING_DELETE_FAILED" }, { status: 500 });
  } finally {
    await dbSession.endSession();
  }

  const cleanup = await Promise.allSettled(fileIds.map((fileId) => deleteFile(new ObjectId(fileId))));
  const failedFileIds = cleanup.flatMap((result, index) => result.status === "rejected" ? [fileIds[index]] : []);
  if (failedFileIds.length) {
    await db.collection("auditLogs").insertOne({
      action: "BOOKING_FILE_CLEANUP_FAILED",
      bookingId,
      actor: session.id,
      fileIds: failedFileIds,
      createdAt: new Date(),
    });
    console.error("BOOKING_FILE_CLEANUP_FAILED", { count: failedFileIds.length });
    return NextResponse.json({ error: "BOOKING_DELETED_FILES_CLEANUP_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
