import { NextRequest, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ status: "INVALID", error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  let roleSession;
  try { roleSession = await requireRole(["admin", "staff"]); }
  catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  const body = await request.json();
  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ status: "INVALID" });
  const db = await getDb();
  const ticket = await db.collection("tickets").findOne({
    $or: [
      { qrToken: token },
      { ticketId: token },
      { invitationCode: token },
    ],
  });
  if (!ticket) return NextResponse.json({ status: "INVALID" });
  if (ticket.status === "CANCELLED") return NextResponse.json({ status: "CANCELLED" });
  if (ticket.checkedIn) return NextResponse.json({ status: "ALREADY_USED" });

  const result = await db.collection("tickets").findOneAndUpdate(
    { _id: ticket._id, checkedIn: false, status: "ACTIVE" },
    { $set: { checkedIn: true, checkedInAt: new Date(), checkedInBy: roleSession.id } },
    { returnDocument: "after" },
  );
  if (!result) return NextResponse.json({ status: "ALREADY_USED" });
  await db.collection("checkins").insertOne({
    ticketId: ticket._id,
    staffId: roleSession.id,
    date: new Date(),
    createdAt: new Date(),
  });
  await db.collection("auditLogs").insertOne({
    action: "TICKET_CHECKED_IN",
    ticketId: ticket._id,
    actor: roleSession.id,
    createdAt: new Date(),
  });
  return NextResponse.json({
    status: "VALID",
    ticket: {
      ticketId: ticket.ticketId,
      guestName: ticket.guestName,
      date: String(ticket.snapshot?.date || ""),
      time: String(ticket.snapshot?.time || ""),
    },
  });
}
