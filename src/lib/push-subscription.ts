export type PushSubscriptionData = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function parsePushSubscription(value: unknown): PushSubscriptionData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const subscription = value as Record<string, unknown>;
  if (typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://")) return null;
  if (!subscription.keys || typeof subscription.keys !== "object" || Array.isArray(subscription.keys)) return null;
  const keys = subscription.keys as Record<string, unknown>;
  if (typeof keys.p256dh !== "string" || !keys.p256dh || typeof keys.auth !== "string" || !keys.auth) return null;
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  };
}

export function pushSubscriptionKey(mobile: string, email: string, endpoint: string) {
  return `${mobile || email}:${endpoint}`;
}
