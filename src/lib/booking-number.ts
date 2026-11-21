import type { Db } from "mongodb";

export async function nextBookingNumber(db: Db) {
  const counter = await db.collection<{ _id: string; value: number }>("counters").findOneAndUpdate(
    { _id: "bookingSequence" },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  if (!counter || typeof counter.value !== "number") throw new Error("BOOKING_SEQUENCE_UNAVAILABLE");
  return counter.value;
}

export function displayBookingNumber(id: string, value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return value;

  const suffix = Number.parseInt(id.slice(-8), 16);
  return `9${String(suffix).padStart(10, "0")}`;
}
