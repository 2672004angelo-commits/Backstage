import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, getBucket, isMongoConfigured } from "@/lib/mongodb";
import { requireRole, getSession } from "@/lib/auth";
import { verifyTicketAccessToken } from "@/lib/ticket";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const db = await getDb();
  const file = await db.collection("uploads.files").findOne({ _id: new ObjectId(id) })
    || await db.collection("fs.files").findOne({ _id: new ObjectId(id) });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (file.metadata?.purpose === "payment-screenshot") {
    try { await requireRole(["admin"]); }
    catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  } else if (file.metadata?.purpose === "ticket") {
    const session = await getSession();
    const bookingId = String(file.metadata?.bookingId || "");
    const accessToken = request.nextUrl.searchParams.get("access") || "";
    if (!session && !(accessToken && await verifyTicketAccessToken(accessToken, bookingId))) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }
  const bucket = await getBucket();
  const chunks: Buffer[] = [];
  for await (const chunk of bucket.openDownloadStream(new ObjectId(id))) chunks.push(Buffer.from(chunk));
  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type": String(file.contentType || "application/octet-stream"),
      "Cache-Control": ["show-poster", "cast-member"].includes(String(file.metadata?.purpose))
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": `inline; filename="${String(file.filename).replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    },
  });
}
