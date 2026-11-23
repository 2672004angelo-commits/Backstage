import QRCode from "qrcode";
import { Resvg } from "@resvg/resvg-js";
import crypto from "crypto";
import path from "path";
import type { Db } from "mongodb";
import { SignJWT, jwtVerify } from "jose";
import { getSecret } from "@/lib/auth";
import fs from "fs";
import { formatPerformanceTime } from "@/lib/show-performances";

export const TICKET_IMAGE_VERSION = 9;

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
  const qr = await QRCode.toBuffer(`${input.appUrl}/admin/checkin?code=${encodeURIComponent(input.qrToken)}`, {
    width: 330,
    margin: 2,
    color: { dark: "#171217", light: "#f4eedf" },
  });
  const escape = (value: string) => value.replace(/[<>&"]/g, (char) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char] || char);
  const arabicFont = getTicketFontBuffer();
  const displayTime = formatPerformanceTime(input.time);
  const fontFamily = "Noto Sans Arabic";
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
    <rect width="1200" height="1800" rx="48" fill="url(#bg)"/>
    <rect x="34" y="34" width="1132" height="1732" rx="34" fill="none" stroke="#b99a5a" stroke-width="3"/>
    <rect x="54" y="54" width="1092" height="1692" rx="24" fill="none" stroke="#dac58f" stroke-opacity=".42" stroke-width="1"/>
    <ellipse cx="600" cy="235" rx="430" ry="210" fill="url(#glow)"/>
    <text x="600" y="165" text-anchor="middle" fill="#dfcb94" font-family="${fontFamily}" font-size="36" letter-spacing="8">THEATRICAL ADMISSION</text>
    <line x1="260" y1="220" x2="940" y2="220" stroke="url(#gold)" stroke-width="3"/>
    <text x="600" y="320" text-anchor="middle" fill="#f4eedf" font-family="${fontFamily}" font-size="92" letter-spacing="14">BACKSTAGE</text>
    <rect x="110" y="390" width="980" height="210" rx="28" fill="#f4eedf" fill-opacity=".07" stroke="#dac58f" stroke-opacity=".38"/>
    <text x="600" y="452" text-anchor="middle" fill="#cbb379" font-family="${fontFamily}" font-size="32" letter-spacing="4">العرض المسرحي</text>
    <text x="600" y="535" text-anchor="middle" fill="#fffaf0" font-family="${fontFamily}" font-size="58" font-weight="700" direction="rtl">${escape(input.showName)}</text>
    <rect x="110" y="650" width="980" height="150" rx="22" fill="#0d0d10" fill-opacity=".62" stroke="#dac58f" stroke-opacity=".22"/>
    <text x="1040" y="704" text-anchor="end" fill="#c9b57f" font-family="${fontFamily}" font-size="30">اسم الضيف</text>
    <text x="1040" y="762" text-anchor="end" fill="#fffaf0" font-family="${fontFamily}" font-size="46" font-weight="700" direction="rtl">${escape(input.guestName)}</text>
    <rect x="110" y="825" width="470" height="170" rx="22" fill="#0d0d10" fill-opacity=".62" stroke="#dac58f" stroke-opacity=".22"/>
    <text x="530" y="880" text-anchor="end" fill="#c9b57f" font-family="${fontFamily}" font-size="30">التاريخ</text>
    <text x="530" y="945" text-anchor="end" fill="#fffaf0" font-family="${fontFamily}" font-size="42" font-weight="700">${escape(input.date)}</text>
    <rect x="620" y="825" width="470" height="170" rx="22" fill="#0d0d10" fill-opacity=".62" stroke="#dac58f" stroke-opacity=".22"/>
    <text x="1040" y="880" text-anchor="end" fill="#c9b57f" font-family="${fontFamily}" font-size="30">الموعد</text>
    <text x="1040" y="945" text-anchor="end" fill="#fffaf0" font-family="${fontFamily}" font-size="42" font-weight="700">${escape(displayTime)}</text>
    <rect x="110" y="1020" width="980" height="150" rx="22" fill="#0d0d10" fill-opacity=".62" stroke="#dac58f" stroke-opacity=".22"/>
    <text x="1040" y="1074" text-anchor="end" fill="#c9b57f" font-family="${fontFamily}" font-size="30">المكان</text>
    <text x="1040" y="1132" text-anchor="end" fill="#fffaf0" font-family="${fontFamily}" font-size="42" font-weight="700" direction="rtl">${escape(input.venue)}</text>
    <line x1="110" y1="1195" x2="1090" y2="1195" stroke="#b99a5a" stroke-width="3" stroke-dasharray="14 14"/>
    <rect x="420" y="1235" width="360" height="360" rx="30" fill="#f4eedf"/>
    <rect x="438" y="1253" width="324" height="324" rx="20" fill="#fff"/>
    <image x="435" y="1250" width="330" height="330" href="data:image/png;base64,${qr.toString("base64")}"/>
    <text x="600" y="1660" text-anchor="middle" fill="#cbb379" font-family="${fontFamily}" font-size="28" letter-spacing="4">رقم التذكرة</text>
    <text x="600" y="1718" text-anchor="middle" fill="#fffaf0" font-family="${fontFamily}" font-size="38" font-weight="700">${escape(input.ticketId)}</text>
  </svg>`;
  const renderer = new Resvg(svg, {
    font: {
      // fontBuffers is supported at runtime in resvg-js 2.6 but missing from its type definitions.
      fontBuffers: [arabicFont],
      loadSystemFonts: false,
      defaultFontFamily: "Noto Sans Arabic",
    } as ConstructorParameters<typeof Resvg>[1] extends { font?: infer F } ? F : never,
  });
  return renderer.render().asPng();
}

let ticketFontBuffer: Buffer | undefined;

function getTicketFontBuffer(): Buffer {
  if (ticketFontBuffer === undefined) {
    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansArabic.ttf");
    if (!fs.existsSync(fontPath)) {
      throw new Error("TICKET_FONT_UNAVAILABLE");
    }
    ticketFontBuffer = fs.readFileSync(fontPath);
  }
  return ticketFontBuffer;
}
