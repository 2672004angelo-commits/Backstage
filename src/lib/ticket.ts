import QRCode from "qrcode";
import { Resvg } from "@resvg/resvg-js";
import * as hb from "harfbuzzjs";
import crypto from "crypto";
import path from "path";
import os from "os";
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
  const displayTime = formatPerformanceTime(input.time);
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
    ${ticketText("THEATRICAL ADMISSION", 600, 165, "middle", 36, "#dfcb94", 8)}
    <line x1="260" y1="220" x2="940" y2="220" stroke="url(#gold)" stroke-width="3"/>
    ${ticketText("BACKSTAGE", 600, 320, "middle", 92, "#f4eedf", 14)}
    <rect x="110" y="390" width="980" height="210" rx="28" fill="#f4eedf" fill-opacity=".07" stroke="#dac58f" stroke-opacity=".38"/>
    ${ticketText("العرض المسرحي", 600, 452, "middle", 32, "#cbb379", 4)}
    ${ticketText(input.showName, 600, 535, "middle", 58, "#fffaf0")}
    <rect x="110" y="650" width="980" height="150" rx="22" fill="#0d0d10" fill-opacity=".62" stroke="#dac58f" stroke-opacity=".22"/>
    ${ticketText("اسم الضيف", 1040, 704, "end", 30, "#c9b57f")}
    ${ticketText(input.guestName, 1040, 762, "end", 46, "#fffaf0")}
    <rect x="110" y="825" width="470" height="170" rx="22" fill="#0d0d10" fill-opacity=".62" stroke="#dac58f" stroke-opacity=".22"/>
    ${ticketText("التاريخ", 530, 880, "end", 30, "#c9b57f")}
    ${ticketText(input.date, 530, 945, "end", 42, "#fffaf0")}
    <rect x="620" y="825" width="470" height="170" rx="22" fill="#0d0d10" fill-opacity=".62" stroke="#dac58f" stroke-opacity=".22"/>
    ${ticketText("الموعد", 1040, 880, "end", 30, "#c9b57f")}
    ${ticketText(displayTime, 1040, 945, "end", 42, "#fffaf0")}
    <rect x="110" y="1020" width="980" height="150" rx="22" fill="#0d0d10" fill-opacity=".62" stroke="#dac58f" stroke-opacity=".22"/>
    ${ticketText("المكان", 1040, 1074, "end", 30, "#c9b57f")}
    ${ticketText(input.venue, 1040, 1132, "end", 42, "#fffaf0")}
    <line x1="110" y1="1195" x2="1090" y2="1195" stroke="#b99a5a" stroke-width="3" stroke-dasharray="14 14"/>
    <rect x="420" y="1235" width="360" height="360" rx="30" fill="#f4eedf"/>
    <rect x="438" y="1253" width="324" height="324" rx="20" fill="#fff"/>
    <image x="435" y="1250" width="330" height="330" href="data:image/png;base64,${qr.toString("base64")}"/>
    ${ticketText("رقم التذكرة", 600, 1660, "middle", 28, "#cbb379", 4)}
    ${ticketText(input.ticketId, 600, 1718, "middle", 38, "#fffaf0")}
  </svg>`;
  // Text is baked in as vector paths, so no font needs to reach resvg at all.
  const renderer = new Resvg(svg, { font: { loadSystemFonts: false } });
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

let hbFont: hb.Font | undefined;
let hbUpem = 1000;

function getHbFont(): hb.Font {
  if (hbFont === undefined) {
    const data = getTicketFontBuffer();
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const face = new hb.Face(new hb.Blob(bytes));
    hbUpem = face.upem || 1000;
    hbFont = new hb.Font(face);
  }
  return hbFont;
}

const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_OR_DIGIT = /[A-Za-z0-9]/;

type TextRun = { text: string; rtl: boolean };

// Split into Arabic and non-Arabic runs. Neutral characters (spaces,
// punctuation, colons, dashes) attach to the preceding run; leading neutrals
// start a left-to-right run. Runs are laid out in logical order, which keeps
// values like "6:00 مساءً" reading naturally with digits on the left.
function splitRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const char of text) {
    if (ARABIC_CHAR.test(char)) {
      const last = runs[runs.length - 1];
      if (last && last.rtl) last.text += char;
      else runs.push({ text: char, rtl: true });
    } else if (LATIN_OR_DIGIT.test(char)) {
      const last = runs[runs.length - 1];
      if (last && !last.rtl) last.text += char;
      else runs.push({ text: char, rtl: false });
    } else {
      const last = runs[runs.length - 1];
      if (last) last.text += char;
      else runs.push({ text: char, rtl: false });
    }
  }
  return runs;
}

type ShapedGlyph = { path: string; dx: number; dy: number; advance: number };

function shapeRun(text: string, rtl: boolean, size: number, letterSpacing: number): ShapedGlyph[] {
  const font = getHbFont();
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.setDirection(rtl ? hb.Direction.RTL : hb.Direction.LTR);
  buffer.setScript(rtl ? "Arab" : "Latn");
  buffer.setLanguage("ar");
  hb.shape(font, buffer);
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  const scale = size / hbUpem;
  const glyphs: ShapedGlyph[] = [];
  for (let i = 0; i < infos.length; i++) {
    glyphs.push({
      path: font.glyphToPath(infos[i].codepoint),
      dx: positions[i].xOffset * scale,
      dy: -positions[i].yOffset * scale,
      advance: positions[i].xAdvance * scale + letterSpacing,
    });
  }
  return glyphs;
}

function ticketText(
  text: string,
  x: number,
  y: number,
  anchor: "middle" | "end",
  size: number,
  fill: string,
  letterSpacing = 0,
): string {
  const font = getHbFont();
  const scale = size / hbUpem;
  const runs = splitRuns(text).map((run) => ({ run, glyphs: shapeRun(run.text, run.rtl, size, letterSpacing) }));
  let total = 0;
  for (const { glyphs } of runs) {
    for (const glyph of glyphs) total += glyph.advance;
    const last = glyphs[glyphs.length - 1];
    if (last && letterSpacing) total -= letterSpacing;
  }
  let pen = anchor === "middle" ? x - total / 2 : x - total;
  const parts: string[] = [];
  for (const { glyphs } of runs) {
    for (const glyph of glyphs) {
      if (glyph.path) {
        const gx = pen + glyph.dx;
        const gy = y + glyph.dy;
        parts.push(
          `<path transform="translate(${gx.toFixed(2)},${gy.toFixed(2)}) scale(${scale.toFixed(5)},${(-scale).toFixed(5)})" d="${glyph.path}"/>`,
        );
      }
      pen += glyph.advance;
    }
  }
  void font;
  return `<g fill="${fill}">${parts.join("")}</g>`;
}
