import QRCode from "qrcode";
import sharp from "sharp";
import crypto from "crypto";
import type { Db } from "mongodb";
import { SignJWT, jwtVerify } from "jose";
import { getSecret } from "@/lib/auth";

export async function nextTicketId(db: Db) {
  const counter = await db.collection<{ _id: string; value: number }>("counters").findOneAndUpdate(
    { _id: "ticketSequence" },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  if (!counter || typeof counter.value !== "number") throw new Error("TICKET_SEQUENCE_UNAVAILABLE");
  return `BACKSTAGE GUEST-${String(counter.value).padStart(6, "0")}`;
}

export function qrToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createTicketAccessToken(bookingId: string) {
  return new SignJWT({ scope: "guest-ticket" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(bookingId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

export async function verifyTicketAccessToken(token: string, bookingId: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload.scope === "guest-ticket" && payload.sub === bookingId;
  } catch {
    return false;
  }
}

export async function makeTicketPng(input: {
  guestName: string;
  showName: string;
  date: string;
  time: string;
  venue: string;
  ticketId: string;
  qrToken: string;
  appUrl: string;
}) {
  const qr = await QRCode.toBuffer(`${input.appUrl}/checkin?t=${encodeURIComponent(input.qrToken)}`, {
    width: 260,
    margin: 1,
  });
  const escape = (value: string) => value.replace(/[<>&"]/g, (char) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char] || char);
  const svg = `<svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="1800" rx="36" fill="#111217"/>
    <rect x="42" y="42" width="1116" height="1716" rx="24" fill="none" stroke="#b89a5a" stroke-width="4"/>
    <text x="600" y="180" text-anchor="middle" fill="#d9bd82" font-family="Georgia" font-size="78" letter-spacing="12">BACKSTAGE</text>
    <text x="600" y="310" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="54">${escape(input.showName)}</text>
    <g fill="#e9e3d8" font-family="Arial" font-size="38">
      <text x="140" y="520">الضيف: ${escape(input.guestName)}</text>
      <text x="140" y="620">التاريخ: ${escape(input.date)}</text>
      <text x="140" y="720">الوقت: ${escape(input.time)}</text>
      <text x="140" y="820">المكان: ${escape(input.venue)}</text>
      <text x="140" y="920">رقم التذكرة: ${escape(input.ticketId)}</text>
    </g>
    <image x="470" y="1120" width="260" height="260" href="data:image/png;base64,${qr.toString("base64")}"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
