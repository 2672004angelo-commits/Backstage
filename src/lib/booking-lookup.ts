import type { Document, Filter } from "mongodb";
import type { ShowPerformance } from "./show-performances";

export function performanceBookingQuery(performance: ShowPerformance): Filter<Document>[] {
  return [
    { performanceId: performance.id },
    {
      performanceId: { $exists: false },
      "showSnapshot.date": performance.date,
      "showSnapshot.time": performance.time,
    },
  ];
}

export function bookingContactQuery(mobile: string, email: string | null): Filter<Document>[] {
  return [
    { mobileNormalized: mobile },
    { mobile: { $in: [mobile, `+${mobile}`] } },
    ...(email ? [
      { emailNormalized: email },
      { email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
    ] : []),
  ];
}
