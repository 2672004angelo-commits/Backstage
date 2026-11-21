import type { Metadata } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { demoShows } from "@/lib/demo";
import { getPublicPageLabel } from "@/lib/site-content";
import { getShowPerformances } from "@/lib/show-performances";
import ShowTicker from "./ShowTicker";
import HeroTypewriter from "./HeroTypewriter";
import PublicSiteNavigation from "./PublicSiteNavigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "BACKSTAGE | عروض وتجارب مسرحية" },
  description: "تعرّف على عروض BACKSTAGE المسرحية القادمة، اكتشف فريق العمل واحجز تذكرتك لتجربة فنية حيّة.",
  alternates: { canonical: "/" },
};

async function getPublicContent() {
  if (!isMongoConfigured()) return { shows: demoShows, pages: [], socialLinks: [] };
  const db = await getDb();
  const [shows, pages, settings] = await Promise.all([
    db.collection("shows").find({ open: true }).sort({ date: 1 }).limit(12).toArray(),
    db.collection("content_pages").find({ published: true }).sort({ title: 1 }).limit(20).toArray(),
    db.collection("settings").findOne({ key: "public" }),
  ]);
  const socialLinks = Array.isArray(settings?.socialLinks) ? settings.socialLinks.flatMap((item) => {
    if (!item || typeof item.label !== "string" || typeof item.url !== "string") return [];
    try {
      const url = new URL(item.url);
      return url.protocol === "https:" ? [{ label: item.label, url: url.toString() }] : [];
    } catch {
      return [];
    }
  }) : [];
  return { shows, pages, socialLinks };
}

export default async function Home() {
  const { shows, pages, socialLinks } = await getPublicContent();
  return (
    <main className="public-site">
      <header className="public-header">
        <div className="container public-header-inner">
          <a className="public-brand" href="/" aria-label="BACKSTAGE - الرئيسية">
            <span className="public-brand-mark" aria-hidden="true">B</span>
            <span>BACKSTAGE</span>
          </a>
          <PublicSiteNavigation
            activePath="/"
            pages={pages.map((page) => ({
              id: page._id.toString(),
              title: getPublicPageLabel(String(page.title), String(page.slug)),
              slug: String(page.slug),
            }))}
          />
        </div>
      </header>
      <section className="public-hero">
        <div className="public-hero-content container">
          <HeroTypewriter />
          <a className="public-cta" href="#shows">اكتشف العروض <span aria-hidden="true">←</span></a>
          <div className="public-hero-note"><span>01</span><span className="public-note-line" /> BACKSTAGE THEATRE</div>
        </div>
      </section>
      <section className="container public-shows" id="shows">
        <div className="public-section-heading">
          <div><span className="public-section-kicker">على خشبة المسرح</span><h2>عروض قادمة</h2></div>
        </div>
        {shows.length > 0
          ? <ShowTicker shows={shows.map((show) => {
            const performances = getShowPerformances(show);
            return {
              id: show._id.toString(),
              title: String(show.title),
              venue: String(show.venue),
              date: performances[0]?.date || String(show.date),
              time: performances.length > 1
                ? `${performances.length} ليالٍ`
                : performances[0]?.time || String(show.time),
              price: Number(show.price).toLocaleString("ar"),
              posterUrl: "posterFileId" in show && show.posterFileId
                ? `/api/files/${String(show.posterFileId)}`
                : undefined,
            };
          })} />
          : <p className="public-empty">لا توجد عروض متاحة حالياً.</p>}
      </section>
      <footer className="public-footer">
        <div className="container public-footer-main">
          <div className="public-footer-about">
            <a className="public-brand" href="/" aria-label="BACKSTAGE - الرئيسية"><span className="public-brand-mark">B</span><span>BACKSTAGE</span></a>
            <p>حكايات نابضة بالحياة، وتجربة تستحق أن تُعاش.</p>
          </div>
          <nav className="public-footer-links" aria-label="روابط الموقع">
            <span className="public-footer-label">استكشف</span>
            <a href="/">الرئيسية</a>
            <a href="#shows">العروض</a>
            <a href="/cast">طاقم العمل</a>
            {pages.map((page) => <a href={`/pages/${encodeURIComponent(String(page.slug))}`} key={page._id.toString()}>{getPublicPageLabel(String(page.title), String(page.slug))}</a>)}
            <a href="/bookings">حجوزاتي</a>
            {socialLinks.length > 0 && <span className="public-footer-label">تواصل معنا</span>}
            {socialLinks.map((link, index) => <a href={link.url} key={`${link.url}-${index}`} target="_blank" rel="noopener noreferrer">{link.label}</a>)}
          </nav>
          <div className="public-footer-credit" lang="en" dir="ltr">
            <span className="public-footer-label">PRODUCTION</span>
            <p>Developed by <strong>Hexa Plus</strong></p>
            <p><span>TECHNICAL SUPERVISION</span><strong>Eng - Angluos Rezq</strong><small>Tech Lead</small></p>
          </div>
        </div>
        <div className="container public-footer-meta" lang="en" dir="ltr">
          <span>© 2025 BACKSTAGE. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}
