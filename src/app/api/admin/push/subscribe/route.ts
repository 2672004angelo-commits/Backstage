import { NextRequest, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { parsePushSubscription } from "@/lib/push-subscription";

export async function POST(request: NextRequest) {
  try { await requireRole(["admin"]); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const subscription = parsePushSubscription(body.subscription);
  if (!subscription) return NextResponse.json({ error: "INVALID_SUBSCRIPTION" }, { status: 400 });
  const db = await getDb();
  const subscriptionKey = `admin:${subscription.endpoint}`;
  await db.collection("pushSubscriptions").updateOne(
    { subscriptionKey },
    {
      $set: {
        role: "admin",
        subscriptionKey,
        endpoint: subscription.endpoint,
        subscription,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  try { await requireRole(["admin"]); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const subscription = parsePushSubscription(body.subscription);
  if (!subscription) return NextResponse.json({ error: "INVALID_SUBSCRIPTION" }, { status: 400 });
  const db = await getDb();
  await db.collection("pushSubscriptions").deleteMany({ subscriptionKey: `admin:${subscription.endpoint}` });
  return NextResponse.json({ ok: true });
}
