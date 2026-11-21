import type { Metadata } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { demoShows } from "@/lib/demo";
import { getShowPerformances } from "@/lib/show-performances";

export const metadata: Metadata = {
  title: "حجز تذكرة",
  robots: { index: false, follow: false },
};

function PerformanceSelect({
  performances,
  selectedId,
}: {
  performances: ReturnType<typeof getShowPerformances>;
  selectedId: string;
}) {
  return (
    <label className="public-booking-field">
      اختر ليلة العرض
      <select className="field" name="performanceId" required defaultValue={selectedId}>
        <option value="" disabled>حدد التاريخ والوقت</option>
        {performances.map((performance, index) => (
          <option key={performance.id} value={performance.id} disabled={!performance.open}>
            {`الليلة ${index + 1} — ${performance.date}، ${performance.time}${performance.open ? "" : " (الحجز مغلق)"}`}
          </option>
        ))}
      </select>
    </label>
  );
}

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
      <main className="container public-booking-page">
        <header className="public-booking-heading">
          <span>BACKSTAGE · حجز التذاكر</span>
          <h1>حجز: {show.title}</h1>
          <p>{show.price.toLocaleString("ar")} د.ع للتذكرة الواحدة لكل ليلة.</p>
        </header>
        <form className="card public-booking-form" action={`/payment/${id}`} method="get">
          <PerformanceSelect performances={performances} selectedId={selectedId} />
          <label className="public-booking-field">الاسم الكامل<input className="field" name="fullName" required minLength={2} defaultValue="ضيف تجربة العرض" /></label>
          <label className="public-booking-field">رقم الهاتف<input className="field" name="mobile" required defaultValue="07701234567" /></label>
          <label className="public-booking-field">البريد الإلكتروني (اختياري)<input className="field" name="email" type="email" /></label>
          <input type="hidden" name="quantity" value="1" />
          <p className="public-booking-note">تذكرة واحدة لكل رقم هاتف أو بريد إلكتروني في الليلة الواحدة. يمكن الحجز لليالي أخرى كلٌّ على حدة.</p>
          <button className="btn" type="submit" disabled={!availablePerformances.length}>متابعة للدفع التجريبي</button>
        </form>
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
      <main className="container public-booking-page">
        <header className="public-booking-heading">
          <span>BACKSTAGE · حجز التذاكر</span>
          <h1>حجز: {demo.title}</h1>
          <p>{demo.price.toLocaleString("ar")} د.ع للتذكرة الواحدة لكل ليلة.</p>
        </header>
        <form className="card public-booking-form" action={`/payment/${id}`} method="get">
          <PerformanceSelect performances={performances} selectedId={selectedId} />
          <label className="public-booking-field">الاسم الكامل<input className="field" name="fullName" required minLength={2} defaultValue="ضيف تجربة العرض" /></label>
          <label className="public-booking-field">رقم الهاتف<input className="field" name="mobile" required defaultValue="07701234567" /></label>
          <label className="public-booking-field">البريد الإلكتروني (اختياري)<input className="field" name="email" type="email" /></label>
          <input type="hidden" name="quantity" value="1" />
          <p className="public-booking-note">تذكرة واحدة لكل رقم هاتف أو بريد إلكتروني في الليلة الواحدة. يمكن الحجز لليالي أخرى كلٌّ على حدة.</p>
          <button className="btn" type="submit" disabled={!availablePerformances.length}>متابعة للدفع التجريبي</button>
        </form>
      </main>
    );
  }
  const performances = getShowPerformances(show);
  const availablePerformances = performances.filter((performance) => performance.open);
  const selectedId = availablePerformances.length === 1
    ? availablePerformances[0].id
    : availablePerformances.some((performance) => performance.id === performanceId) ? performanceId || "" : "";

  return (
    <main className="container public-booking-page">
      <header className="public-booking-heading">
        <span>BACKSTAGE · حجز التذاكر</span>
        <h1>حجز: {String(show.title)}</h1>
        <p>{Number(show.price).toLocaleString("ar")} د.ع للتذكرة الواحدة لكل ليلة.</p>
      </header>
      {availablePerformances.length ? (
        <form className="card public-booking-form" action="/api/bookings" method="post">
          <input type="hidden" name="showId" value={id} />
          <input type="hidden" name="quantity" value="1" />
          <PerformanceSelect performances={performances} selectedId={selectedId} />
          <label className="public-booking-field">الاسم الكامل<input className="field" name="fullName" required minLength={2} /></label>
          <label className="public-booking-field">رقم الهاتف<input className="field" name="mobile" required pattern="\+?[0-9]{8,15}" /></label>
          <label className="public-booking-field">البريد الإلكتروني (اختياري)<input className="field" name="email" type="email" /></label>
          <p className="public-booking-note">تذكرة واحدة لكل رقم هاتف أو بريد إلكتروني في الليلة الواحدة. يمكن الحجز لليالي أخرى كلٌّ على حدة.</p>
          <button className="btn" type="submit">تأكيد الحجز والدفع</button>
        </form>
      ) : (
        <p className="public-booking-closed">الحجز مغلق لجميع ليالي هذا العرض حاليًا.</p>
      )}
    </main>
  );
}
