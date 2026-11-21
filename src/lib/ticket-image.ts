import { ObjectId, type Db, type Document } from "mongodb";
import { deleteFile, uploadFile } from "@/lib/gridfs";
import { makeTicketPng, TICKET_IMAGE_VERSION } from "@/lib/ticket";

type TicketImageResult = {
  fileId: ObjectId;
  updated: boolean;
  oldFileCleanupFailed: boolean;
};

export async function regenerateTicketImage(
  db: Db,
  ticketId: ObjectId,
  appUrl: string,
  options: { onlyIfOutdated?: boolean; allowCheckedIn?: boolean } = {},
): Promise<TicketImageResult> {
  const ticket = await db.collection("tickets").findOne({ _id: ticketId });
  if (!ticket) throw new Error("TICKET_NOT_FOUND");
  if (!options.allowCheckedIn && ticket.checkedIn) throw new Error("TICKET_ALREADY_USED");
  if (!ticket.ticketId || typeof ticket.qrToken !== "string" || !ticket.qrToken) {
    throw new Error("TICKET_DATA_INCOMPLETE");
  }
  if (ticket.bookingId == null || !ObjectId.isValid(String(ticket.bookingId))) {
    throw new Error("BOOKING_NOT_FOUND");
  }
  if (ticket.ticketImageFileId != null && !ObjectId.isValid(String(ticket.ticketImageFileId))) {
    throw new Error("INVALID_FILE_REFERENCE");
  }

  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(String(ticket.bookingId)) });
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  const snapshot: Document = ticket.snapshot && typeof ticket.snapshot === "object" && !Array.isArray(ticket.snapshot)
    ? ticket.snapshot as Document
    : {};
  const bookingSnapshot = booking.showSnapshot || {};
  const guestName = String(ticket.guestName || booking.fullName || "").trim();
  const showName = String(snapshot.showName || snapshot.title || bookingSnapshot.title || "").trim();
  const date = String(snapshot.date || bookingSnapshot.date || "").trim();
  const time = String(snapshot.time || bookingSnapshot.time || "").trim();
  const venue = String(snapshot.venue || bookingSnapshot.venue || "").trim();
  if (!guestName || !showName || !date || !time || !venue) {
    throw new Error("TICKET_DATA_INCOMPLETE");
  }

  const png = await makeTicketPng({
    guestName,
    showName,
    date,
    time,
    venue,
    ticketId: String(ticket.ticketId),
    qrToken: ticket.qrToken,
    appUrl,
  });
  const newFileId = await uploadFile(png, `ticket-${String(ticket.ticketId).replace(/[^A-Z0-9-]/g, "-")}.png`, "image/png", {
    purpose: "ticket",
    bookingId: String(ticket.bookingId),
    immutable: true,
  });

  const updateFilter: Document = { _id: ticketId };
  if (!options.allowCheckedIn) updateFilter.checkedIn = { $ne: true };
  if (ticket.ticketImageFileId === undefined) updateFilter.ticketImageFileId = { $exists: false };
  else updateFilter.ticketImageFileId = ticket.ticketImageFileId;
  if (options.onlyIfOutdated) updateFilter.imageVersion = { $ne: TICKET_IMAGE_VERSION };

  let updated = false;
  try {
    const result = await db.collection("tickets").updateOne(updateFilter, {
      $set: { ticketImageFileId: newFileId, imageVersion: TICKET_IMAGE_VERSION, updatedAt: new Date() },
    });
    updated = result.matchedCount > 0;
  } catch (error) {
    try {
      await deleteFile(newFileId);
    } catch (cleanupError) {
      console.error("REGENERATED_TICKET_FILE_CLEANUP_FAILED", cleanupError instanceof Error ? cleanupError.name : "UnknownError");
    }
    throw error;
  }

  if (!updated) {
    await deleteFile(newFileId);
    const current = await db.collection("tickets").findOne({ _id: ticketId });
    if (!current?.ticketImageFileId || !ObjectId.isValid(String(current.ticketImageFileId))) {
      throw new Error("TICKET_IMAGE_CHANGED");
    }
    return {
      fileId: new ObjectId(String(current.ticketImageFileId)),
      updated: false,
      oldFileCleanupFailed: false,
    };
  }

  let oldFileCleanupFailed = false;
  if (ticket.ticketImageFileId) {
    try {
      await deleteFile(new ObjectId(String(ticket.ticketImageFileId)));
    } catch (error) {
      oldFileCleanupFailed = true;
      console.error("TICKET_IMAGE_CLEANUP_FAILED", error instanceof Error ? error.name : "UnknownError");
    }
  }
  return { fileId: newFileId, updated: true, oldFileCleanupFailed };
}
