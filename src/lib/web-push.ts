import * as webpush from "web-push";
import type { Db } from "mongodb";

export function isWebPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function configureWebPush() {
  if (!isWebPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@backstage.local",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

export async function sendBookingPush(
  db: Db,
  bookingId: string,
  payload: { title: string; body: string; url: string },
) {
  if (!configureWebPush()) return;
  const subscriptions = await db.collection("pushSubscriptions")
    .find({ bookingIds: bookingId })
    .toArray();
  await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription.subscription, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
      });
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await db.collection("pushSubscriptions").deleteOne({ _id: subscription._id });
      } else {
        const errorName = error instanceof Error ? error.name : "UnknownError";
        console.error("WEB_PUSH_DELIVERY_FAILED", { statusCode, errorName });
      }
    }
  }));
}

export async function sendAdminPush(
  db: Db,
  payload: { title: string; body: string; url: string },
) {
  if (!configureWebPush()) return;
  const subscriptions = await db.collection("pushSubscriptions")
    .find({ role: "admin" })
    .toArray();
  await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription.subscription, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
      });
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await db.collection("pushSubscriptions").deleteOne({ _id: subscription._id });
      } else {
        const errorName = error instanceof Error ? error.name : "UnknownError";
        console.error("ADMIN_WEB_PUSH_DELIVERY_FAILED", { statusCode, errorName });
      }
    }
  }));
}
