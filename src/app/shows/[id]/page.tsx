import type { Metadata } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { demoShows } from "@/lib/demo";
import { getShowPerformances } from "@/lib/show-performances";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return { title: "العرض غير موجود", robots: { index: false, follow: false } };

  const show = isMongoConfigured()
    ? await (await getDb()).collection("shows").findOne({ _id: new ObjectId(id) })
    : demoShows.find((item) => item._id === id);
  if (!show) return { title: "العرض غير موجود", robots: { index: false, follow: false } };

  const title = String(show.title);
  const description = String(show.description || `تفاصيل ومواعيد حجز عرض ${title} من BACKSTAGE.`)
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const url = `/shows/${id}`;
  const image = "posterFileId" in show && show.posterFileId
    ? `/api/files/${String(show.posterFileId)}`
    : "/backstage.jpg";
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: `${title} | BACKSTAGE`,
      description,
      url,
      images: [{ url: image, alt: `ملصق عرض ${title}` }],
    },
  };
}

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  if (!isMongoConfigured()) {
    const demo = demoShows.find((item) => item._id === id);
    if (!demo) notFound();
    const performances = getShowPerformances(demo);
    return (
      <main className="container" style={{ maxWidth: 760, padding: "48px 0" }}>
        <a href="/" style={{ color: "var(--gold)" }}>← العودة للعروض</a>
        <section className="card" style={{ marginTop: 24, padding: 32 }}>
          <p style={{ color: "var(--gold)" }}>عرض مسرحي</p>
          <h1 style={{ fontFamily: "Georgia", fontSize: 48 }}>{demo.title}</h1>
          <p style={{ lineHeight: 2, color: "#bbb" }}>{demo.description}</p>
          <p><strong>المكان:</strong> {demo.venue}</p>
          <p style={{ color: "var(--gold)", fontSize: 24 }}>{demo.price.toLocaleString("ar")} جنيه</p>
          <section className="public-performance-list">
            <h2>مواعيد ليالي العرض</h2>
            {performances.map((performance, index) => (
              <div className="public-performance-card" key={performance.id}>
                <strong>الليلة {index + 1}</strong>
                <span>{performance.date} · {performance.time}</span>
                {performance.open
                  ? <a className="btn" href={`/booking/${id}?performanceId=${encodeURIComponent(performance.id)}`}>احجز هذه الليلة</a>
                  : <span className="public-performance-closed">الحجز مغلق</span>}
              </div>
            ))}
          </section>
        </section>
      </main>
    );
  }
  const show = await (await getDb()).collection("shows").findOne({ _id: new ObjectId(id) });
  if (!show) {
    const demo = demoShows.find((item) => item._id === id);
    if (!demo) notFound();
    const performances = getShowPerformances(demo);
    return (
      <main className="container" style={{ padding: "64px 0" }}>
        <a href="/" style={{ color: "var(--gold)" }}>← العودة للعروض</a>
        <section className="card" style={{ marginTop: 24, padding: 32 }}>
          <p style={{ color: "var(--gold)" }}>عرض مسرحي تجريبي</p>
          <h1 style={{ fontFamily: "Georgia", fontSize: 48 }}>{demo.title}</h1>
          <p style={{ lineHeight: 2, color: "#bbb" }}>{demo.description}</p>
          <p><strong>المكان:</strong> {demo.venue}</p>
          <p style={{ color: "var(--gold)", fontSize: 24 }}>{demo.price.toLocaleString("ar")} جنيه</p>
          <section className="public-performance-list">
            <h2>مواعيد ليالي العرض</h2>
            {performances.map((performance, index) => (
              <div className="public-performance-card" key={performance.id}>
                <strong>الليلة {index + 1}</strong>
                <span>{performance.date} · {performance.time}</span>
                {performance.open
                  ? <a className="btn" href={`/booking/${id}?performanceId=${encodeURIComponent(performance.id)}`}>احجز هذه الليلة</a>
                  : <span className="public-performance-closed">الحجز مغلق</span>}
              </div>
            ))}
          </section>
        </section>
      </main>
    );
  }
  const cast = Array.isArray(show.cast) ? show.cast : [];
  const performances = getShowPerformances(show);
  return (
    <main className="container" style={{ padding: "64px 0" }}>
      <a href="/" style={{ color: "var(--gold)" }}>← العودة للعروض</a>
      <section className="card" style={{ marginTop: 24, padding: 32 }}>
        {show.posterFileId && <img className="public-show-poster-main" src={`/api/files/${String(show.posterFileId)}`} alt={`ملصق ${String(show.title)}`} />}
        <p style={{ color: "var(--gold)" }}>عرض مسرحي</p>
        <h1 style={{ fontFamily: "Georgia", fontSize: 48 }}>{show.title as string}</h1>
        <p style={{ lineHeight: 2, color: "#bbb" }}>{show.description as string}</p>
        <p><strong>المكان:</strong> {show.venue as string}</p>
        <p style={{ color: "var(--gold)", fontSize: 24 }}>{Number(show.price).toLocaleString("ar")} جنيه</p>
        <section className="public-performance-list">
          <h2>مواعيد ليالي العرض</h2>
          {performances.map((performance, index) => (
            <div className="public-performance-card" key={performance.id}>
              <strong>الليلة {index + 1}</strong>
              <span>{performance.date} · {performance.time}</span>
              {performance.open
                ? <a className="btn" href={`/booking/${id}?performanceId=${encodeURIComponent(performance.id)}`}>احجز هذه الليلة</a>
                : <span className="public-performance-closed">الحجز مغلق</span>}
            </div>
          ))}
        </section>
        {cast.length > 0 && (
          <section className="public-cast-section">
            <h2>أبطال العرض</h2>
            <div className="public-cast-grid">
              {cast.map((member, index) => (
                <article className="public-cast-card" key={`${String(member.photoFileId || member.name)}-${index}`}>
                  {member.photoFileId && <img src={`/api/files/${String(member.photoFileId)}`} alt={`صورة ${String(member.name)}`} />}
                  <div className="public-cast-card-details"><h3>{String(member.name)}</h3>{member.role && <p>{String(member.role)}</p>}</div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
