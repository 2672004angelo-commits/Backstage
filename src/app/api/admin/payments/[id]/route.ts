import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { qrToken, nextTicketId, makeTicketPng } from "@/lib/ticket";
import { deleteFile, uploadFile } from "@/lib/gridfs";
import { sendBookingPush } from "@/lib/web-push";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  try { await requireRole(["admin"]); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const body = await request.json();
  const action = String(body.action || "");
  if (!["approve", "reject", "resubmit", "delete_payment", "update_method"].includes(action)) {
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  }
  if (action === "reject" && !String(body.reason || "").trim()) {
    return NextResponse.json({ error: "REJECTION_REASON_REQUIRED" }, { status: 400 });
  }
  const paymentId = String(body.paymentId || "");
  if (["delete_payment", "update_method"].includes(action) && !ObjectId.isValid(paymentId)) {
    return NextResponse.json({ error: "INVALID_PAYMENT_ID" }, { status: 400 });
  }
  if (action === "update_method" && !["INSTAPAY", "CASH_WALLET"].includes(String(body.paymentMethod))) {
    return NextResponse.json({ error: "INVALID_PAYMENT_METHOD" }, { status: 400 });
  }

  const db = await getDb();
  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(id) });
  if (!booking) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (action === "delete_payment" || action === "update_method") {
    if (booking.status === "APPROVED") {
      return NextResponse.json({ error: "APPROVED_PAYMENT_LOCKED" }, { status: 409 });
    }
    const payment = await db.collection("payments").findOne({
      _id: new ObjectId(paymentId),
      bookingId: booking._id,
    });
    if (!payment) return NextResponse.json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
    if (action === "update_method") {
      await db.collection("payments").updateOne({ _id: payment._id }, {
        $set: { paymentMethod: String(body.paymentMethod), updatedAt: new Date() },
      });
      await db.collection("auditLogs").insertOne({
        action: "PAYMENT_METHOD_UPDATED",
        bookingId: booking._id,
        paymentId: payment._id,
        actor: "admin",
        createdAt: new Date(),
      });
      return NextResponse.json({ ok: true });
    }
    const latestPayment = await db.collection("payments")
      .find({ bookingId: booking._id })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
    if (!latestPayment || !latestPayment._id.equals(payment._id)) {
      return NextResponse.json({ error: "PAYMENT_NOT_LATEST" }, { status: 409 });
    }
    const screenshotFileId = payment.screenshotFileId ? String(payment.screenshotFileId) : "";
    if (screenshotFileId && !ObjectId.isValid(screenshotFileId)) {
      return NextResponse.json({ error: "INVALID_FILE_REFERENCE" }, { status: 409 });
    }
    await db.collection("payments").deleteOne({ _id: payment._id });
    await db.collection("bookings").updateOne({ _id: booking._id }, {
      $set: { status: "PENDING_PAYMENT", updatedAt: new Date() },
      $unset: { rejectionReason: "" },
    });
    await db.collection("auditLogs").insertOne({
      action: "PAYMENT_PROOF_DELETED",
      bookingId: booking._id,
      paymentId: payment._id,
      actor: "admin",
      createdAt: new Date(),
    });
    if (screenshotFileId) {
      try {
        await deleteFile(new ObjectId(screenshotFileId));
      } catch (error) {
        await db.collection("auditLogs").insertOne({
          action: "PAYMENT_FILE_CLEANUP_FAILED",
          bookingId: booking._id,
          paymentId: payment._id,
          fileId: new ObjectId(screenshotFileId),
          actor: "admin",
          createdAt: new Date(),
        });
        console.error("PAYMENT_FILE_CLEANUP_FAILED", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "PAYMENT_DELETED_FILE_CLEANUP_FAILED" }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "approve") {
    if (!["PENDING_REVIEW", "APPROVED"].includes(booking.status)) {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 409 });
    }

    if (booking.status === "PENDING_REVIEW") {
      await db.collection("payments").updateMany({ bookingId: booking._id }, { $set: { status: "APPROVED" } });
      await db.collection("bookings").updateOne({ _id: booking._id, status: "PENDING_REVIEW" }, {
        $set: { status: "APPROVED", approvedAt: new Date(), updatedAt: new Date() },
      });
    }

    for (let i = 0; i < Number(booking.quantity); i++) {
      const existing = await db.collection("tickets").findOne({ bookingId: booking._id, ticketIndex: i });
      if (existing) continue;
      const token = qrToken();
      const code = await nextTicketId(db);
      const png = await makeTicketPng({
        guestName: booking.fullName,
        showName: booking.showSnapshot.title,
        date: String(booking.showSnapshot.date),
        time: String(booking.showSnapshot.time),
        venue: booking.showSnapshot.venue,
        ticketId: code,
        qrToken: token,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      });
      const ticketFileId = await uploadFile(png, `ticket-${code.replace(/[^A-Z0-9-]/g, "-")}.png`, "image/png", {
        purpose: "ticket",
        bookingId: id,
        immutable: true,
      });
      await db.collection("tickets").insertOne({
        ticketId: code,
        bookingId: booking._id,
        showId: booking.showId,
        guestName: booking.fullName,
        invitationCode: code,
        qrToken: token,
        ticketImageFileId: ticketFileId,
        ticketIndex: i,
        status: "ACTIVE",
        checkedIn: false,
        snapshot: {
          showName: booking.showSnapshot.title,
          date: booking.showSnapshot.date,
          time: booking.showSnapshot.time,
          venue: booking.showSnapshot.venue,
        },
        createdAt: new Date(),
      });
    }
    const issuedCount = await db.collection("tickets").countDocuments({ bookingId: booking._id, status: "ACTIVE" });
    if (issuedCount !== Number(booking.quantity)) {
      return NextResponse.json({
        error: "TICKET_ISSUANCE_INCOMPLETE",
        issuedCount,
        quantity: Number(booking.quantity),
      }, { status: 500 });
    }
  } else if (action === "reject") {
    await db.collection("bookings").updateOne({ _id: booking._id }, {
      $set: { status: "REJECTED", rejectionReason: String(body.reason).trim(), updatedAt: new Date() },
    });
    await db.collection("payments").updateMany({ bookingId: booking._id }, {
      $set: { status: "REJECTED", reason: String(body.reason).trim() },
    });
  } else {
    await db.collection("bookings").updateOne({ _id: booking._id }, {
      $set: { status: "PENDING_PAYMENT", rejectionReason: "يرجى إعادة رفع صورة الدفع", updatedAt: new Date() },
    });
  }
  await db.collection("auditLogs").insertOne({
    action: `PAYMENT_${action.toUpperCase()}`,
    bookingId: booking._id,
    actor: "admin",
    createdAt: new Date(),
  });
  if (action === "approve") {
    await sendBookingPush(db, id, {
      title: "تذكرتك جاهزة",
      body: "تم اعتماد التحويل وإصدار تذكرة عرضك. افتح صفحة حجوزاتي لعرضها وتنزيلها.",
      url: "/bookings",
    });
  } else if (action === "reject") {
    await sendBookingPush(db, id, {
      title: "تعذر اعتماد التحويل",
      body: "تم رفض إثبات الدفع. راجع سبب الرفض وأعد رفع الصورة.",
      url: "/bookings",
    });
  }
  const issuedCount = action === "approve"
    ? await db.collection("tickets").countDocuments({ bookingId: booking._id, status: "ACTIVE" })
    : undefined;
  return NextResponse.json({ ok: true, issuedCount, quantity: Number(booking.quantity) });
}
