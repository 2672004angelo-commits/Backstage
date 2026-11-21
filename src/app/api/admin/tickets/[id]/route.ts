import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { deleteFile } from "@/lib/gridfs";
import { TICKET_IMAGE_VERSION } from "@/lib/ticket";
import { regenerateTicketImage } from "@/lib/ticket-image";

type RouteContext = { params: Promise<{ id: string }> };

async function authorize() {
  try { return await requireRole(["admin"]); }
  catch { return null; }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const db = await getDb();
  const ticketId = new ObjectId(id);
  const ticket = await db.collection("tickets").findOne({ _id: ticketId });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (ticket.checkedIn) return NextResponse.json({ error: "TICKET_ALREADY_USED" }, { status: 409 });

  if (body.action === "regenerate_image") {
    let result: Awaited<ReturnType<typeof regenerateTicketImage>>;
    try {
      result = await regenerateTicketImage(db, ticketId, process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (["TICKET_DATA_INCOMPLETE", "BOOKING_NOT_FOUND", "INVALID_FILE_REFERENCE", "TICKET_ALREADY_USED"].includes(code)) {
        return NextResponse.json({ error: code }, { status: 409 });
      }
      throw error;
    }
    if (!result.updated) {
      return NextResponse.json({ error: "TICKET_CHANGED" }, { status: 409 });
    }
    await db.collection("auditLogs").insertOne({
      action: "TICKET_IMAGE_REGENERATED",
      ticketId,
      bookingId: ticket.bookingId,
      actor: session.id,
      createdAt: new Date(),
    });
    if (result.oldFileCleanupFailed) {
      await db.collection("auditLogs").insertOne({
        action: "TICKET_IMAGE_CLEANUP_FAILED",
        ticketId,
        fileId: ticket.ticketImageFileId,
        actor: session.id,
        createdAt: new Date(),
      });
      return NextResponse.json({ error: "TICKET_IMAGE_UPDATED_CLEANUP_FAILED" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, imageVersion: TICKET_IMAGE_VERSION });
  }

  if (!["ACTIVE", "CANCELLED"].includes(String(body.status))) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }
  const updated = await db.collection("tickets").updateOne(
    { _id: ticketId, checkedIn: { $ne: true } },
    { $set: { status: body.status, updatedAt: new Date() } },
  );
  if (!updated.matchedCount) return NextResponse.json({ error: "TICKET_ALREADY_USED" }, { status: 409 });
  await db.collection("auditLogs").insertOne({
    action: body.status === "CANCELLED" ? "TICKET_CANCELLED" : "TICKET_REACTIVATED",
    ticketId,
    actor: session.id,
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: true, status: body.status });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const db = await getDb();
  const ticketId = new ObjectId(id);
  const ticket = await db.collection("tickets").findOne({ _id: ticketId });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (ticket.checkedIn) return NextResponse.json({ error: "TICKET_ALREADY_USED" }, { status: 409 });
  const fileId = ticket.ticketImageFileId ? String(ticket.ticketImageFileId) : "";
  if (fileId && !ObjectId.isValid(fileId)) return NextResponse.json({ error: "INVALID_FILE_REFERENCE" }, { status: 409 });

  const deleted = await db.collection("tickets").deleteOne({ _id: ticketId, checkedIn: { $ne: true } });
  if (!deleted.deletedCount) return NextResponse.json({ error: "TICKET_ALREADY_USED" }, { status: 409 });
  await db.collection("checkins").deleteMany({ ticketId });
  await db.collection("auditLogs").insertOne({
    action: "TICKET_DELETED",
    ticketId,
    bookingId: ticket.bookingId,
    actor: session.id,
    createdAt: new Date(),
  });
  if (fileId) {
    try {
      await deleteFile(new ObjectId(fileId));
    } catch (error) {
      await db.collection("auditLogs").insertOne({
        action: "TICKET_FILE_CLEANUP_FAILED",
        ticketId,
        fileId: new ObjectId(fileId),
        actor: session.id,
        createdAt: new Date(),
      });
      console.error("TICKET_FILE_CLEANUP_FAILED", error instanceof Error ? error.name : "UnknownError");
      return NextResponse.json({ error: "TICKET_DELETED_FILE_CLEANUP_FAILED" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
