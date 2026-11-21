import { NextRequest, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { uploadFile, deleteFile } from "@/lib/gridfs";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  try { await requireRole(["admin"]); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  const form = await request.formData();
  const kind = String(form.get("kind") || "");
  const file = form.get("file");
  if (!kind || !(file instanceof File)) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "image/svg+xml") {
    const svg = new TextDecoder().decode(bytes).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    if (/on[a-z]+\s*=|href\s*=\s*["'](?!#|data:image)/gi.test(svg)) {
      return NextResponse.json({ error: "UNSAFE_SVG" }, { status: 400 });
    }
  }
  const db = await getDb();
  const current = await db.collection("settings").findOne({ key: "branding" });
  if (current?.[`${kind}FileId`] && ObjectId.isValid(String(current[`${kind}FileId`]))) {
    await deleteFile(new ObjectId(String(current[`${kind}FileId`]))).catch(() => undefined);
  }
  const fileId = await uploadFile(bytes, file.name, file.type, { purpose: "branding", kind, immutable: true });
  await db.collection("settings").updateOne(
    { key: "branding" },
    { $set: { [`${kind}FileId`]: fileId, updatedAt: new Date() } },
    { upsert: true },
  );
  return NextResponse.json({ id: fileId });
}
