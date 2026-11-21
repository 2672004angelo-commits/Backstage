import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";
import { legacyPerformanceId } from "../src/lib/show-performances";

loadEnvConfig(process.cwd());

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "backstage");
  const bookingIndexesOnly = process.argv.includes("--booking-indexes-only");

  if (!bookingIndexesOnly) {
    await db.collection("admins").createIndex({ email: 1 }, { unique: true });
    await db.collection("staff").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection("shows").createIndex({ date: 1, open: 1 });
  }
  const bookings = db.collection("bookings");
  await bookings.createIndex({ showId: 1, status: 1 });
  await bookings.createIndex({ showId: 1, performanceId: 1, status: 1 });
  await bookings.createIndex({ mobile: 1, createdAt: -1 });
  await bookings.createIndex({ bookingNumber: 1 }, { unique: true, sparse: true });
  const existingBookingIndexes = await bookings.listIndexes().toArray();
  for (const legacyIndexName of ["showId_1_mobileNormalized_1", "showId_1_emailNormalized_1"]) {
    if (existingBookingIndexes.some((index) => index.name === legacyIndexName)) {
      await bookings.dropIndex(legacyIndexName);
    }
  }
  const legacyBookings = bookings.find(
    { performanceId: { $exists: false } },
    { projection: { showSnapshot: 1 } },
  );
  for await (const booking of legacyBookings) {
    const date = typeof booking.showSnapshot?.date === "string" ? booking.showSnapshot.date : "";
    const time = typeof booking.showSnapshot?.time === "string" ? booking.showSnapshot.time : "";
    if (date && time) {
      await bookings.updateOne(
        { _id: booking._id, performanceId: { $exists: false } },
        { $set: { performanceId: legacyPerformanceId(date, time) } },
      );
    }
  }
  await db.collection("bookings").createIndex(
    { showId: 1, performanceId: 1, mobileNormalized: 1 },
    {
      unique: true,
      partialFilterExpression: {
        performanceId: { $type: "string" },
        mobileNormalized: { $type: "string" },
      },
    },
  );
  await db.collection("bookings").createIndex(
    { showId: 1, performanceId: 1, emailNormalized: 1 },
    {
      unique: true,
      partialFilterExpression: {
        performanceId: { $type: "string" },
        emailNormalized: { $type: "string" },
      },
    },
  );
  if (!bookingIndexesOnly) {
    await db.collection("payments").createIndex({ bookingId: 1 });
    await db.collection("tickets").createIndex({ qrToken: 1 }, { unique: true });
    await db.collection("tickets").createIndex({ bookingId: 1, ticketIndex: 1 }, { unique: true });
    await db.collection("tickets").createIndex({ invitationCode: 1 }, { unique: true });
    await db.collection("tickets").createIndex({ ticketId: 1 }, { unique: true });
    await db.collection("checkins").createIndex({ ticketId: 1 });
    await db.collection("auditLogs").createIndex({ createdAt: -1 });
    await db.collection("settings").createIndex({ key: 1 }, { unique: true });
    await db.collection("content_pages").createIndex({ slug: 1 }, { unique: true });
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!bookingIndexesOnly && email && password) {
    const existing = await db.collection("admins").findOne({ email: email.toLowerCase() });
    if (!existing) {
      await db.collection("admins").insertOne({
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        role: "admin",
        active: true,
        createdAt: new Date(),
      });
      console.log(`Created initial admin: ${email}`);
    }
  }
  await client.close();
  console.log(bookingIndexesOnly
    ? "Booking indexes are ready."
    : "MongoDB indexes and collections are ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
