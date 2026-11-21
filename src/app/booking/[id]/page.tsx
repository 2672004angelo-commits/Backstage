import type { Metadata } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { demoShows } from "@/lib/demo";
import { getShowPerformances } from "@/lib/show-performances";
import LanguageToggle from "../../LanguageToggle";
import BookingForm from "./BookingForm";

export const metadata: Metadata = {
  title: "حجز تذكرة",
  robots: { index: false, follow: false },
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ performanceId?: string }>;
}) {
  const [{ id }, { performanceId }] = await Promise.all([params, searchParams]);
  if (!ObjectId.isValid(id)) notFound();

  if (!isMongoConfigured()) {
    const show = demoShows.find((item) => item._id === id);
    if (!show) notFound();
    const performances = getShowPerformances(show);
    const availablePerformances = performances.filter((performance) => performance.open);
    const selectedId = availablePerformances.length === 1
      ? availablePerformances[0].id
      : availablePerformances.some((performance) => performance.id === performanceId) ? performanceId || "" : "";
    return (
      <main className="public-ambient-page">
        <div className="public-ambient-content public-booking-page">
          <div className="public-page-locale"><LanguageToggle /></div>
          <header className="public-booking-heading">
            <span>BACKSTAGE · حجز التذاكر</span>
            <h1>حجز: {show.title}</h1>
            <p>{show.price.toLocaleString("ar")} جنيه للتذكرة الواحدة لكل ليلة.</p>
          </header>
          <BookingForm showId={id} performances={performances} selectedId={selectedId} demoMode />
        </div>
      </main>
    );
  }

  const show = await (await getDb()).collection("shows").findOne({ _id: new ObjectId(id) });
  if (!show) {
    const demo = demoShows.find((item) => item._id === id);
    if (!demo) notFound();
    const performances = getShowPerformances(demo);
    const availablePerformances = performances.filter((performance) => performance.open);
    const selectedId = availablePerformances.length === 1
      ? availablePerformances[0].id
      : availablePerformances.some((performance) => performance.id === performanceId) ? performanceId || "" : "";
    return (
      <main className="public-ambient-page">
        <div className="public-ambient-content public-booking-page">
          <div className="public-page-locale"><LanguageToggle /></div>
          <header className="public-booking-heading">
            <span>BACKSTAGE · حجز التذاكر</span>
            <h1>حجز: {demo.title}</h1>
            <p>{demo.price.toLocaleString("ar")} جنيه للتذكرة الواحدة لكل ليلة.</p>
          </header>
          <BookingForm showId={id} performances={performances} selectedId={selectedId} demoMode />
        </div>
      </main>
    );
  }
  const performances = getShowPerformances(show);
  const availablePerformances = performances.filter((performance) => performance.open);
  const selectedId = availablePerformances.length === 1
    ? availablePerformances[0].id
    : availablePerformances.some((performance) => performance.id === performanceId) ? performanceId || "" : "";

  return (
    <main className="public-ambient-page">
      <div className="public-ambient-content public-booking-page">
        <div className="public-page-locale"><LanguageToggle /></div>
        <header className="public-booking-heading">
          <span>BACKSTAGE · حجز التذاكر</span>
          <h1>حجز: {String(show.title)}</h1>
          <p>{Number(show.price).toLocaleString("ar")} جنيه للتذكرة الواحدة لكل ليلة.</p>
        </header>
        {availablePerformances.length ? (
          <BookingForm showId={id} performances={performances} selectedId={selectedId} />
        ) : (
          <p className="public-booking-closed">الحجز مغلق لجميع ليالي هذا العرض حاليًا.</p>
        )}
      </div>
    </main>
  );
}
