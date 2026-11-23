import type { ClientSession, Db, MongoClient, ObjectId } from "mongodb";
import { performanceBookingQuery } from "@/lib/booking-lookup";
import type { ShowPerformance } from "@/lib/show-performances";

// A seat is held only once payment proof is uploaded (PENDING_REVIEW) or the payment
// is approved. PENDING_PAYMENT bookings never count toward capacity.
export const SEAT_HOLDING_STATUSES = ["PENDING_REVIEW", "APPROVED"];

export class BookingConflict extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "BookingConflict";
  }
}

export function performanceLockId(showId: string, performanceId: string) {
  return `${showId}:${performanceId}`;
}

async function ensurePerformanceLock(db: Db, lockId: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await db.collection("performanceLocks").updateOne(
        { _id: lockId } as never,
        { $setOnInsert: { n: 0, createdAt: new Date() } },
        { upsert: true },
      );
      return;
    } catch (error) {
      // Two concurrent first-time creations: one wins the insert, the other retries as update.
      if ((error as { code?: number })?.code === 11000) continue;
      throw error;
    }
  }
}

/**
 * Runs `work` inside a transaction that first takes an atomic write on the
 * performance's lock document. Concurrent transactions for the same
 * (show, performance) hit a write conflict on that document, abort, and
 * retry with a fresh snapshot, so the capacity check + insert inside `work`
 * can never oversell the night, no matter how many guests book at once.
 */
export async function withPerformanceLock<T>(
  client: MongoClient,
  db: Db,
  lockId: string,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await ensurePerformanceLock(db, lockId);
  const session = client.startSession();
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        let output: T | undefined;
        await session.withTransaction(async () => {
          const lock = await db.collection("performanceLocks").findOneAndUpdate(
            { _id: lockId } as never,
            { $inc: { n: 1 } },
            { session, returnDocument: "after" },
          );
          if (!lock) throw new BookingConflict("PERFORMANCE_UNAVAILABLE");
          output = await work(session);
        });
        return output as T;
      } catch (error) {
        if (error instanceof BookingConflict) throw error;
        const labels = (error as { errorLabels?: string[] })?.errorLabels || [];
        const code = (error as { code?: number })?.code;
        const transient = labels.includes("TransientTransactionError")
          || labels.includes("UnknownTransactionCommitResult")
          || code === 112; // WriteConflict
        if (transient && attempt < 4) continue;
        throw error;
      }
    }
    throw new Error("TRANSACTION_RETRY_EXHAUSTED");
  } finally {
    await session.endSession();
  }
}

export async function soldQuantityForPerformance(
  db: Db,
  showObjectId: ObjectId,
  performance: ShowPerformance,
  session: ClientSession,
  excludeBookingId?: ObjectId,
) {
  const sold = await db.collection("bookings").aggregate([
    {
      $match: {
        ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
        showId: showObjectId,
        status: { $in: SEAT_HOLDING_STATUSES },
        $or: performanceBookingQuery(performance),
      },
    },
    { $group: { _id: null, quantity: { $sum: "$quantity" } } },
  ], { session }).next();
  return Number(sold?.quantity || 0);
}
