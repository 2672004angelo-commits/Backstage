export type ShowPerformance = {
  id: string;
  date: string;
  time: string;
  open: boolean;
};

type ShowScheduleSource = {
  performances?: unknown;
  date?: unknown;
  time?: unknown;
  open?: unknown;
};

export function legacyPerformanceId(date: string, time: string) {
  return `legacy-${date.replace(/[^a-zA-Z0-9]/g, "")}-${time.replace(/[^a-zA-Z0-9]/g, "")}`;
}

export function getShowPerformances(value: unknown): ShowPerformance[] {
  if (!value || typeof value !== "object") return [];
  const show = value as ShowScheduleSource;
  if (Array.isArray(show.performances)) {
    const performances = show.performances.flatMap((item): ShowPerformance[] => {
      if (!item || typeof item !== "object") return [];
      const performance = item as Record<string, unknown>;
      const date = typeof performance.date === "string" ? performance.date : "";
      const time = typeof performance.time === "string" ? performance.time : "";
      if (!date || !time) return [];
      return [{
        id: typeof performance.id === "string" && performance.id
          ? performance.id
          : legacyPerformanceId(date, time),
        date,
        time,
        open: performance.open !== false && show.open !== false,
      }];
    });
    if (performances.length) return performances;
  }

  const date = typeof show.date === "string" ? show.date : "";
  const time = typeof show.time === "string" ? show.time : "";
  if (!date || !time) return [];
  return [{
    id: legacyPerformanceId(date, time),
    date,
    time,
    open: show.open !== false,
  }];
}
