import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { uploadFile } from "@/lib/gridfs";
import { showSchema } from "@/lib/validation";
import { legacyPerformanceId } from "@/lib/show-performances";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 8 * 1024 * 1024;

function optionalFile(value: FormDataEntryValue | null): File | null | undefined {
  if (value === null) return null;
  if (!(value instanceof File)) return undefined;
  if (!value.name && value.size === 0) return null;
  return value;
}

function validImage(file: File) {
  return imageTypes.has(file.type) && file.size > 0 && file.size <= maxImageSize;
}

export async function POST(request: NextRequest) {
  if (!isMongoConfigured()) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  try { await requireRole(["admin"]); }
  catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }

  const form = await request.formData();
  const showIdValue = String(form.get("id") || "");
  if (showIdValue && !ObjectId.isValid(showIdValue)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  let castInput: unknown;
  try {
    castInput = JSON.parse(String(form.get("cast") || "[]"));
  } catch {
    return NextResponse.json({ error: "INVALID_CAST" }, { status: 400 });
  }

  let performancesInput: unknown;
  const performancesValue = form.get("performances");
  if (typeof performancesValue === "string" && performancesValue) {
    try {
      performancesInput = JSON.parse(performancesValue);
    } catch {
      return NextResponse.json({ error: "INVALID_PERFORMANCES" }, { status: 400 });
    }
  }

  const parsed = showSchema.safeParse({
    title: form.get("title"),
    description: form.get("description") || "",
    date: form.get("date"),
    time: form.get("time"),
    venue: form.get("venue"),
    price: Number(form.get("price")),
    capacity: Number(form.get("capacity")),
    open: form.get("open") === "on",
    performances: performancesInput,
    cast: castInput,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const performanceInputs = parsed.data.performances?.length
    ? parsed.data.performances
    : [{
      date: parsed.data.date,
      time: parsed.data.time,
      open: parsed.data.open,
      id: legacyPerformanceId(parsed.data.date, parsed.data.time),
    }];
  const performances = performanceInputs.map((performance) => ({
    id: performance.id || new ObjectId().toString(),
    date: performance.date,
    time: performance.time,
    open: performance.open,
  }));
  if (new Set(performances.map((performance) => performance.id)).size !== performances.length) {
    return NextResponse.json({ error: "DUPLICATE_PERFORMANCE_ID" }, { status: 400 });
  }
  if (new Set(performances.map((performance) => `${performance.date}T${performance.time}`)).size !== performances.length) {
    return NextResponse.json({ error: "DUPLICATE_PERFORMANCE_TIME" }, { status: 400 });
  }

  const db = await getDb();
  const showId = showIdValue ? new ObjectId(showIdValue) : new ObjectId();
  const current = showIdValue ? await db.collection("shows").findOne({ _id: showId }) : null;
  if (showIdValue && !current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const poster = optionalFile(form.get("poster"));
  if (poster === undefined || (poster && !validImage(poster))) {
    return NextResponse.json({ error: "INVALID_POSTER" }, { status: 400 });
  }
  const currentPosterId = current?.posterFileId ? String(current.posterFileId) : "";
  const requestedPosterId = String(form.get("posterFileId") || "");
  if (requestedPosterId && requestedPosterId !== currentPosterId) {
    return NextResponse.json({ error: "INVALID_POSTER_REFERENCE" }, { status: 400 });
  }

  const currentCastPhotoIds = new Set(
    Array.isArray(current?.cast)
      ? current.cast.map((member) => String(member.photoFileId || ""))
      : [],
  );
  const castInputs: { member: (typeof parsed.data.cast)[number]; photo: File | null; existingPhotoId: string }[] = [];
  for (let index = 0; index < parsed.data.cast.length; index++) {
    const member = parsed.data.cast[index];
    const photo = optionalFile(form.get(`castPhoto-${index}`));
    if (photo === undefined || (photo && !validImage(photo))) {
      return NextResponse.json({ error: "INVALID_CAST_PHOTO", index }, { status: 400 });
    }

    const existingPhotoId = member.photoFileId || "";
    if (existingPhotoId && !currentCastPhotoIds.has(existingPhotoId)) {
      return NextResponse.json({ error: "INVALID_CAST_PHOTO_REFERENCE", index }, { status: 400 });
    }
    if (!photo && !existingPhotoId) {
      return NextResponse.json({ error: "CAST_PHOTO_REQUIRED", index }, { status: 400 });
    }
    castInputs.push({ member, photo, existingPhotoId });
  }

  const posterFileId = poster
    ? await uploadFile(new Uint8Array(await poster.arrayBuffer()), poster.name, poster.type, {
      purpose: "show-poster",
      showId: showId.toString(),
      immutable: true,
    })
    : current?.posterFileId || null;
  const cast = [];
  for (const { member, photo, existingPhotoId } of castInputs) {
    const photoFileId = photo
      ? await uploadFile(new Uint8Array(await photo.arrayBuffer()), photo.name, photo.type, {
        purpose: "cast-member",
        showId: showId.toString(),
        immutable: true,
      })
      : new ObjectId(existingPhotoId);
    cast.push({ name: member.name, role: member.role, photoFileId });
  }

  const document = {
    ...parsed.data,
    date: performances[0].date,
    time: performances[0].time,
    open: performances.some((performance) => performance.open),
    performances,
    cast,
    posterFileId,
    updatedAt: new Date(),
  };
  if (current) {
    await db.collection("shows").updateOne({ _id: showId }, { $set: document });
  } else {
    await db.collection("shows").insertOne({ _id: showId, ...document, createdAt: new Date() });
  }
  return NextResponse.json({ id: showId.toString() }, { status: current ? 200 : 201 });
}
