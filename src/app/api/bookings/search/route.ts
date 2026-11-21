import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { createTicketAccessToken } from "@/lib/ticket";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const mobile = typeof body.mobile === "string" ? body.mobile.trim().replace(/^\+/, "") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!ObjectId.isValid(bookingId) || !/^[0-9]{8,15}$/.test(mobile)) {
    return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const db = await getDb();
  const booking = await db.collection("bookings").findOne({
    _id: new ObjectId(bookingId),
    $or: [
      { mobileNormalized: mobile },
      { mobile: { $in: [mobile, `+${mobile}`] } },
    ],
  });
  if (!booking) return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });
  const storedEmail = String(booking.emailNormalized || booking.email || "").trim().toLowerCase();
  if (storedEmail && email !== storedEmail) {
    return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const tickets = booking.status === "APPROVED"
    ? await db.collection("tickets").find({ bookingId: booking._id }).sort({ ticketIndex: 1 }).toArray()
    : [];
  const accessToken = tickets.length ? await createTicketAccessToken(bookingId) : "";
  return NextResponse.json({
    status: String(booking.status),
    show: String(booking.showSnapshot?.title || "العرض"),
    performanceDate: String(booking.showSnapshot?.date || ""),
    performanceTime: String(booking.showSnapshot?.time || ""),
    quantity: Number(booking.quantity),
    rejectionReason: booking.rejectionReason ? String(booking.rejectionReason) : undefined,
    tickets: tickets.map((ticket) => ({
      ticketId: String(ticket.ticketId),
      imageUrl: `/api/files/${ticket.ticketImageFileId}?access=${encodeURIComponent(accessToken)}`,
    })),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
