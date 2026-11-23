import { NextRequest, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  try { await requireRole(["admin"]); } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const db = await getDb();
  const key = String(body.key || "");
  if (key === "public") {
    if (!Array.isArray(body.socialLinks) || body.socialLinks.length > 10) {
      return NextResponse.json({ error: "INVALID_SOCIAL_LINKS" }, { status: 400 });
    }
    const socialLinks = [];
    for (const item of body.socialLinks) {
      if (!item || typeof item !== "object") return NextResponse.json({ error: "INVALID_SOCIAL_LINK" }, { status: 400 });
      const link = item as Record<string, unknown>;
      const label = typeof link.label === "string" ? link.label.trim() : "";
      const value = typeof link.url === "string" ? link.url.trim() : "";
      let url: URL;
      try { url = new URL(value); }
      catch { return NextResponse.json({ error: "INVALID_SOCIAL_URL" }, { status: 400 }); }
      if (!label || label.length > 40 || value.length > 500 || url.protocol !== "https:") {
        return NextResponse.json({ error: "INVALID_SOCIAL_LINK" }, { status: 400 });
      }
      socialLinks.push({ label, url: url.toString() });
    }
    await db.collection("settings").updateOne(
      { key },
      { $set: { key, socialLinks, updatedAt: new Date() } },
      { upsert: true },
    );
  } else {
    return NextResponse.json({ error: "INVALID_SETTINGS_KEY" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  try { await requireRole(["admin"]); }
  catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
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
  const key = String(body.key || "");
  if (!["public"].includes(key)) {
    return NextResponse.json({ error: "INVALID_SETTINGS_KEY" }, { status: 400 });
  }
  await (await getDb()).collection("settings").deleteOne({ key });
  return NextResponse.json({ ok: true });
}
