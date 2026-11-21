import type { Metadata } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getPublicPageLabel } from "@/lib/site-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "طاقم العمل",
  description: "تعرّف على الفنانين وصنّاع الحكايات في عروض BACKSTAGE المسرحية.",
  alternates: { canonical: "/cast" },
  openGraph: {
    title: "طاقم العمل | BACKSTAGE",
    description: "تعرّف على الفنانين وصنّاع الحكايات في عروض BACKSTAGE المسرحية.",
    url: "/cast",
    images: [{ url: "/backstage.jpg", alt: "فريق BACKSTAGE على خشبة المسرح" }],
  },
};

type CastMember = { name: string; role: string; photoFileId: string };
type CastGroup = {
  showId: string;
  showTitle: string;
  date: string;
  venue: string;
  members: CastMember[];
};

export default async function CastPage() {
  const groups: CastGroup[] = [];
  let pages: { id: string; title: string; slug: string }[] = [];

  if (isMongoConfigured()) {
    const db = await getDb();
    const [shows, publishedPages] = await Promise.all([
      db.collection("shows").find({ "cast.0": { $exists: true } }).sort({ date: 1 }).limit(100).toArray(),
      db.collection("content_pages").find({ published: true }).sort({ title: 1 }).limit(20).toArray(),
    ]);
    pages = publishedPages.map((page) => ({
      id: page._id.toString(),
      title: getPublicPageLabel(String(page.title), String(page.slug)),
      slug: String(page.slug),
    }));

    for (const show of shows) {
      if (!Array.isArray(show.cast)) continue;
      const members = show.cast
        .filter((member) => member.name && member.photoFileId)
        .map((member) => ({
          name: String(member.name),
          role: String(member.role || ""),
          photoFileId: String(member.photoFileId),
        }));
      if (members.length) {
        groups.push({
          showId: show._id.toString(),
          showTitle: String(show.title),
          date: String(show.date || ""),
          venue: String(show.venue || ""),
          members,
        });
      }
    }
  }

  return (
    <main className="public-site public-cast-site">
      <header className="public-header">
        <div className="container public-header-inner">
          <a className="public-brand" href="/" aria-label="BACKSTAGE - الرئيسية">
            <span className="public-brand-mark" aria-hidden="true">B</span>
            <span>BACKSTAGE</span>
          </a>
          <nav className="public-nav" aria-label="التنقل الرئيسي">
            <a href="/">الرئيسية</a>
            <a href="/#shows">العروض</a>
            <a href="/cast" aria-current="page">طاقم العمل</a>
            {pages.map((page) => <a href={`/pages/${encodeURIComponent(page.slug)}`} key={page.id}>{page.title}</a>)}
            <a href="/bookings">حجوزاتي</a>
          </nav>
        </div>
      </header>

      <section className="public-cast-hero">
        <div className="container public-cast-hero-inner">
          <div className="public-content-eyebrow"><span>صنّاع الحكايات</span><i /></div>
          <p>الفنانون خلف العروض</p>
          <h1>طاقم العمل</h1>
          <span className="public-cast-hero-mark" aria-hidden="true">B</span>
        </div>
      </section>

      <div className="container public-cast-content">
        {groups.length ? groups.map((group, groupIndex) => (
          <section className="public-cast-group" key={group.showId}>
            <header className="public-cast-group-heading">
              <span className="public-cast-group-index">{String(groupIndex + 1).padStart(2, "0")}</span>
              <div>
                <p>طاقم العرض</p>
                <h2>{group.showTitle}</h2>
                <span>{[group.date, group.venue].filter(Boolean).join(" · ")}</span>
              </div>
              <a className="public-cast-show-link" href={`/shows/${group.showId}`}>تفاصيل العرض <span aria-hidden="true">←</span></a>
            </header>
            <div className="public-cast-grid">
              {group.members.map((member, index) => (
                <a className="public-cast-card" href={`/shows/${group.showId}`} key={`${member.photoFileId}-${index}`}>
                  <div className="public-cast-card-image">
                    <img src={`/api/files/${member.photoFileId}`} alt={`صورة ${member.name}`} loading="lazy" />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="public-cast-card-details">
                    {member.role && <p>{member.role}</p>}
                    <h3>{member.name}</h3>
                    <small>{group.showTitle}</small>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )) : (
          <section className="public-cast-empty">
            <span aria-hidden="true">B</span>
            <p>قريبًا</p>
            <h2>فنانو BACKSTAGE</h2>
            <div>نجهّز لكم لقاءً مع الفنانين المشاركين في عروضنا القادمة. عودوا قريبًا لاكتشافهم.</div>
            <a className="public-cta" href="/#shows">اكتشف العروض <span aria-hidden="true">←</span></a>
          </section>
        )}
      </div>

      <footer className="public-content-footer">
        <div className="container">
          <a href="/">BACKSTAGE <span>— حكايات نابضة بالحياة</span></a>
          <nav aria-label="صفحات الموقع">
            <a href="/">الرئيسية</a>
            <a href="/#shows">العروض</a>
            <a href="/cast">طاقم العمل</a>
            {pages.map((page) => <a href={`/pages/${encodeURIComponent(page.slug)}`} key={page.id}>{page.title}</a>)}
            <a href="/bookings">حجوزاتي</a>
          </nav>
          <span>© 2025 BACKSTAGE</span>
        </div>
      </footer>
    </main>
  );
}
