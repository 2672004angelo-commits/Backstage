import { NextRequest, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { hashPassword, signSession, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { ObjectId } from "mongodb";

type AdminDocument = {
  email: string;
  passwordHash: string;
  active?: boolean;
  role?: string;
  createdAt?: Date;
};

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) {
    const body = await request.json();
    const email = String(body.email || "").toLowerCase();
    if (email && String(body.password || "").length >= 8) {
      const token = await signSession("demo-admin", "admin");
      const response = NextResponse.json({ ok: true, role: "admin", demo: true });
      response.cookies.set("backstage_session", token, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const db = await getDb();
  const admins = db.collection<AdminDocument>("admins");
  let account: {
    _id?: ObjectId;
    email: string;
    passwordHash: string;
    active?: boolean;
    role?: string;
  } | null = await admins.findOne({ email: parsed.data.email.toLowerCase() });
  const environmentEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const canBootstrapAdmin = !account
    && parsed.data.email.toLowerCase() === environmentEmail
    && !(await admins.findOne({}, { projection: { _id: 1 } }));
  if (canBootstrapAdmin) {
    account = {
      _id: undefined,
      email: parsed.data.email.toLowerCase(),
      passwordHash: await hashPassword(process.env.ADMIN_PASSWORD || ""),
      role: "admin",
    };
  }
  if (!account || account.active === false || !(await verifyPassword(parsed.data.password, account.passwordHash))) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  if (!account._id) {
    const inserted = await admins.insertOne({
      email: parsed.data.email.toLowerCase(),
      passwordHash: account.passwordHash,
      role: "admin",
      active: true,
      createdAt: new Date(),
    });
    account._id = inserted.insertedId;
  }
  const token = await signSession(account._id.toString(), "admin");
  const response = NextResponse.json({ ok: true, role: "admin" });
  response.cookies.set("backstage_session", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
