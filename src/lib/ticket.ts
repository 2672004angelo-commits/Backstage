import QRCode from "qrcode";
import sharp from "sharp";
import crypto from "crypto";
import path from "path";
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
    width: 330,
    margin: 2,
    color: { dark: "#171217", light: "#f4eedf" },
  });
  const escape = (value: string) => value.replace(/[<>&"]/g, (char) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char] || char);
  const svg = `<svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#24191d"/>
        <stop offset=".52" stop-color="#151318"/>
        <stop offset="1" stop-color="#0f1013"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#9d7a3d"/>
        <stop offset=".5" stop-color="#eddbab"/>
        <stop offset="1" stop-color="#a88448"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0" stop-color="#d4b973" stop-opacity=".22"/>
        <stop offset="1" stop-color="#d4b973" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="1800" rx="48" fill="#111217" fill-opacity=".76"/>
    <rect x="34" y="34" width="1132" height="1732" rx="34" fill="none" stroke="#b99a5a" stroke-width="3"/>
    <rect x="54" y="54" width="1092" height="1692" rx="24" fill="none" stroke="#dac58f" stroke-opacity=".42" stroke-width="1"/>
    <ellipse cx="600" cy="235" rx="430" ry="210" fill="url(#glow)"/>
    <text x="600" y="155" text-anchor="middle" fill="#dfcb94" font-family="Arial" font-size="34" letter-spacing="7">THEATRICAL ADMISSION</text>
    <line x1="300" y1="205" x2="900" y2="205" stroke="url(#gold)" stroke-width="2"/>
    <text x="600" y="300" text-anchor="middle" fill="#f4eedf" font-family="Georgia" font-size="86" letter-spacing="12">BACKSTAGE</text>
    <rect x="90" y="390" width="1020" height="190" rx="22" fill="#f4eedf" fill-opacity=".055" stroke="#dac58f" stroke-opacity=".28"/>
    <text x="600" y="448" text-anchor="middle" fill="#cbb379" font-family="Arial" font-size="28" letter-spacing="5">العرض المسرحي</text>
    <text x="600" y="528" text-anchor="middle" fill="#fffaf0" font-family="Arial" font-size="56" font-weight="700">${escape(input.showName)}</text>
    <rect x="90" y="650" width="1020" height="120" rx="18" fill="#0d0d10" fill-opacity=".58" stroke="#dac58f" stroke-opacity=".16"/>
    <text x="1040" y="720" text-anchor="end" fill="#bda979" font-family="Arial" font-size="28">اسم الضيف</text>
    <text x="140" y="720" text-anchor="start" fill="#fffaf0" font-family="Arial" font-size="38" font-weight="700">${escape(input.guestName)}</text>
    <rect x="90" y="790" width="496" height="150" rx="18" fill="#0d0d10" fill-opacity=".58" stroke="#dac58f" stroke-opacity=".16"/>
    <text x="540" y="840" text-anchor="end" fill="#bda979" font-family="Arial" font-size="26">التاريخ</text>
    <text x="540" y="895" text-anchor="end" fill="#fffaf0" font-family="Arial" font-size="38" font-weight="700">${escape(input.date)}</text>
    <rect x="614" y="790" width="496" height="150" rx="18" fill="#0d0d10" fill-opacity=".58" stroke="#dac58f" stroke-opacity=".16"/>
    <text x="1064" y="840" text-anchor="end" fill="#bda979" font-family="Arial" font-size="26">الموعد</text>
    <text x="1064" y="895" text-anchor="end" fill="#fffaf0" font-family="Arial" font-size="38" font-weight="700">${escape(input.time)}</text>
    <rect x="90" y="960" width="1020" height="120" rx="18" fill="#0d0d10" fill-opacity=".58" stroke="#dac58f" stroke-opacity=".16"/>
    <text x="1040" y="1030" text-anchor="end" fill="#bda979" font-family="Arial" font-size="26">المكان</text>
    <text x="140" y="1030" text-anchor="start" fill="#fffaf0" font-family="Arial" font-size="34" font-weight="700">${escape(input.venue)}</text>
    <line x1="90" y1="1120" x2="1110" y2="1120" stroke="#b99a5a" stroke-width="2" stroke-dasharray="12 12"/>
    <rect x="420" y="1160" width="360" height="360" rx="28" fill="#f4eedf"/>
    <rect x="438" y="1178" width="324" height="324" rx="18" fill="#fff"/>
    <image x="435" y="1175" width="330" height="330" href="data:image/png;base64,${qr.toString("base64")}"/>
    <text x="600" y="1585" text-anchor="middle" fill="#cbb379" font-family="Arial" font-size="24" letter-spacing="3">رقم التذكرة</text>
    <text x="600" y="1645" text-anchor="middle" fill="#fffaf0" font-family="Arial" font-size="34" font-weight="700">${escape(input.ticketId)}</text>
    <text x="600" y="1710" text-anchor="middle" fill="#91866e" font-family="Arial" font-size="20">يرجى إبراز هذه التذكرة عند دخول المسرح</text>
  </svg>`;
  const background = await sharp(path.join(process.cwd(), "public", "backstage.jpg"))
    .resize(1200, 1800, { fit: "cover", position: "centre" })
    .modulate({ brightness: 0.72, saturation: 0.82 })
    .toBuffer();
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(background)
    .composite([{ input: overlay, blend: "over" }])
    .png()
    .toBuffer();
}
