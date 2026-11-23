import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export type Role = "admin" | "staff" | "customer";

let warnedAboutDefaultSecret = false;

export function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Keep the site running without it, but make the gap loud in logs.
    if (!warnedAboutDefaultSecret) {
      warnedAboutDefaultSecret = true;
      console.warn("JWT_SECRET is not configured; using the built-in development secret. Set JWT_SECRET in production.");
    }
    return new TextEncoder().encode("development-secret-change-before-production");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(subject: string, role: Role) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function getSession() {
  const token = (await cookies()).get("backstage_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { id: payload.sub as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function requireRole(roles: Role[]) {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
