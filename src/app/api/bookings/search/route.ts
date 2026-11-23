import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { createTicketAccessToken, TICKET_IMAGE_VERSION } from "@/lib/ticket";
import { displayBookingNumber } from "@/lib/booking-number";
import { regenerateTicketImage } from "@/lib/ticket-image";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }

  const mobile = typeof body.mobile === "string" ? body.mobile.trim().replace(/^\+/, "") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[0-9]{8,15}$/.test(mobile) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const db = await getDb();
  // Both the phone and the email used at booking time must match.
  const bookings = await db.collection("bookings").find({
    $and: [
      {
        $or: [
          { mobileNormalized: mobile },
          { mobile: { $in: [mobile, `+${mobile}`] } },
        ],
      },
      {
        $or: [
          { emailNormalized: email },
          { email },
        ],
      },
    ],
  }).sort({ createdAt: -1 }).limit(50).toArray();
  if (!bookings.length) return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });

  const bookingResults = [];
  for (const booking of bookings) {
    const tickets = booking.status === "APPROVED"
      ? await db.collection("tickets").find({ bookingId: booking._id, status: "ACTIVE" }).sort({ ticketIndex: 1 }).toArray()
      : [];
    const accessToken = tickets.length
      ? await createTicketAccessToken(booking._id.toString())
      : "";
    const ticketImages = [];
    for (const ticket of tickets) {
      let fileId = ticket.ticketImageFileId;
      if (ticket.imageVersion !== TICKET_IMAGE_VERSION || !fileId) {
        const regeneration = await regenerateTicketImage(
          db,
          ticket._id,
          process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin,
          {
            onlyIfOutdated: Boolean(fileId && ticket.imageVersion != null),
            allowCheckedIn: true,
          },
        );
        fileId = regeneration.fileId;
        if (regeneration.updated) {
          await db.collection("auditLogs").insertOne({
            action: "TICKET_IMAGE_AUTO_REGENERATED",
            ticketId: ticket._id,
            bookingId: booking._id,
            actor: "system",
            createdAt: new Date(),
          });
        }
      }
      if (!fileId || !ObjectId.isValid(String(fileId))) throw new Error("TICKET_IMAGE_UNAVAILABLE");
      ticketImages.push({
        ticketId: String(ticket.ticketId),
        imageUrl: `/api/files/${String(fileId)}?access=${encodeURIComponent(accessToken)}`,
      });
    }
    bookingResults.push({
      id: booking._id.toString(),
      bookingNumber: displayBookingNumber(booking._id.toString(), booking.bookingNumber),
      status: String(booking.status),
      show: String(booking.showSnapshot?.title || "العرض"),
      performanceDate: String(booking.showSnapshot?.date || ""),
      performanceTime: String(booking.showSnapshot?.time || ""),
      fullName: String(booking.fullName || ""),
      quantity: Number(booking.quantity),
      rejectionReason: booking.rejectionReason ? String(booking.rejectionReason) : undefined,
      tickets: ticketImages,
    });
  }
  return NextResponse.json({
    bookings: bookingResults,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
