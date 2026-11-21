import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { createTicketAccessToken } from "@/lib/ticket";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }

  const mobile = typeof body.mobile === "string" ? body.mobile.trim().replace(/^\+/, "") : "";
  if (!/^[0-9]{8,15}$/.test(mobile)) {
    return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const db = await getDb();
  const bookings = await db.collection("bookings").find({
    $or: [
      { mobileNormalized: mobile },
      { mobile: { $in: [mobile, `+${mobile}`] } },
    ],
  }).sort({ createdAt: -1 }).limit(50).toArray();
  if (!bookings.length) return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });

  const bookingResults = [];
  for (const booking of bookings) {
    const tickets = booking.status === "APPROVED"
      ? await db.collection("tickets").find({ bookingId: booking._id }).sort({ ticketIndex: 1 }).toArray()
      : [];
    const accessToken = tickets.length
      ? await createTicketAccessToken(booking._id.toString())
      : "";
    bookingResults.push({
      id: booking._id.toString(),
      status: String(booking.status),
      show: String(booking.showSnapshot?.title || "العرض"),
      performanceDate: String(booking.showSnapshot?.date || ""),
      performanceTime: String(booking.showSnapshot?.time || ""),
      fullName: String(booking.fullName || ""),
      quantity: Number(booking.quantity),
      rejectionReason: booking.rejectionReason ? String(booking.rejectionReason) : undefined,
      tickets: tickets.map((ticket) => ({
        ticketId: String(ticket.ticketId),
        imageUrl: `/api/files/${ticket.ticketImageFileId}?access=${encodeURIComponent(accessToken)}`,
      })),
    });
  }
  return NextResponse.json({
    bookings: bookingResults,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
