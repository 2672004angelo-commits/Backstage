import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { sitePageSchema } from "@/lib/validation";

async function authorize() {
  try {
    await requireRole(["admin"]);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  if (!(await authorize())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = sitePageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const id = typeof body.id === "string" ? body.id : "";
  if (id && !ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const db = await getDb();
  const collection = db.collection("content_pages");
  const pageId = id ? new ObjectId(id) : new ObjectId();
  const existing = id ? await collection.findOne({ _id: pageId }) : null;
  if (id && !existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const duplicate = await collection.findOne({
    slug: parsed.data.slug,
    ...(id ? { _id: { $ne: pageId } } : {}),
  });
  if (duplicate) return NextResponse.json({ error: "SLUG_ALREADY_EXISTS" }, { status: 409 });

  const document = { ...parsed.data, updatedAt: new Date() };
  if (existing) {
    await collection.updateOne({ _id: pageId }, { $set: document });
  } else {
    await collection.insertOne({ _id: pageId, ...document, createdAt: new Date() });
  }
  return NextResponse.json({ id: pageId.toString() }, { status: existing ? 200 : 201 });
}

export async function DELETE(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  if (!(await authorize())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (typeof body.id !== "string" || !ObjectId.isValid(body.id)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }
  const result = await (await getDb()).collection("content_pages").deleteOne({ _id: new ObjectId(body.id) });
  if (!result.deletedCount) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
