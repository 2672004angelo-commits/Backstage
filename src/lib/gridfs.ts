import { Readable } from "stream";
import { ObjectId } from "mongodb";
import { getBucket } from "./mongodb";

export async function uploadFile(
  bytes: Uint8Array,
  filename: string,
  contentType: string,
  metadata: Record<string, unknown> = {},
) {
  if (bytes.length > 8 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const bucket = await getBucket();
  const id = new ObjectId();
  await new Promise<void>((resolve, reject) => {
    const stream = bucket.openUploadStreamWithId(id, filename, {
      contentType,
      metadata,
    });
    stream.on("error", reject);
    stream.on("finish", () => resolve());
    Readable.from(Buffer.from(bytes)).pipe(stream);
  });
  return id;
}

export async function openFile(id: ObjectId) {
  const bucket = await getBucket();
  return bucket.openDownloadStream(id);
}

export async function deleteFile(id: ObjectId) {
  const bucket = await getBucket();
  await bucket.delete(id);
}
