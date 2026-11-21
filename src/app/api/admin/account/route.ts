import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";

const credentialsSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newEmail: z.string().trim().email().max(254).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  }

  const session = await getSession();
  if (!session || session.role !== "admin" || !ObjectId.isValid(session.id)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success || (!parsed.data?.newEmail && !parsed.data?.newPassword)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const db = await getDb();
  const admins = db.collection("admins");
  const account = await admins.findOne({ _id: new ObjectId(session.id) });
  if (!account || account.active === false || typeof account.passwordHash !== "string") {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!(await verifyPassword(parsed.data.currentPassword, account.passwordHash))) {
    return NextResponse.json({ error: "INVALID_CURRENT_PASSWORD" }, { status: 403 });
  }

  const updates: { email?: string; passwordHash?: string; updatedAt?: Date } = {};
  const newEmail = parsed.data.newEmail?.toLowerCase();
  if (newEmail && newEmail !== String(account.email).toLowerCase()) updates.email = newEmail;
  if (parsed.data.newPassword) updates.passwordHash = await hashPassword(parsed.data.newPassword);
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }
  updates.updatedAt = new Date();

  try {
    await admins.updateOne({ _id: account._id }, { $set: updates });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "EMAIL_IN_USE" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
