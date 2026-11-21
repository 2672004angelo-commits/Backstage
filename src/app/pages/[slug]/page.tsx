import type { Metadata } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getPublicPageLabel } from "@/lib/site-content";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isMongoConfigured() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { title: "الصفحة غير متاحة", robots: { index: false, follow: false } };
  }
  const page = await (await getDb()).collection("content_pages").findOne({ slug, published: true });
  if (!page) return { title: "الصفحة غير موجودة", robots: { index: false, follow: false } };

  const title = getPublicPageLabel(String(page.title), slug);
  const content = String(page.content || "").replace(/\s+/g, " ").trim();
  const description = content.slice(0, 160) || `اقرأ صفحة ${title} على موقع BACKSTAGE.`;
  const url = `/pages/${encodeURIComponent(slug)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: `${title} | BACKSTAGE`,
      description,
      url,
      images: [{ url: "/backstage.jpg", alt: "BACKSTAGE" }],
    },
  };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isMongoConfigured() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const db = await getDb();
  const [page, pages] = await Promise.all([
    db.collection("content_pages").findOne({ slug, published: true }),
    db.collection("content_pages").find({ published: true }).sort({ title: 1 }).limit(20).toArray(),
  ]);
  if (!page) notFound();
  const paragraphs = String(page.content || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const pageTitle = getPublicPageLabel(String(page.title), slug);
  return (
    <main className="public-site public-content-site">
      <header className="public-header">
        <div className="container public-header-inner">
          <a className="public-brand" href="/" aria-label="BACKSTAGE - الرئيسية">
            <span className="public-brand-mark" aria-hidden="true">B</span>
            <span>BACKSTAGE</span>
          </a>
          <nav className="public-nav" aria-label="التنقل الرئيسي">
            <a href="/">الرئيسية</a>
            <a href="/#shows">العروض</a>
            <a href="/cast">طاقم العمل</a>
            {pages.map((item) => <a href={`/pages/${encodeURIComponent(String(item.slug))}`} key={item._id.toString()}>{getPublicPageLabel(String(item.title), String(item.slug))}</a>)}
            <a href="/bookings">حجوزاتي</a>
          </nav>
        </div>
      </header>
      <section className="public-content-hero">
        <div className="container public-content-hero-inner">
          <div className="public-content-eyebrow"><span>BACKSTAGE JOURNAL</span><i /></div>
          <p>مساحة للحكايات والتفاصيل</p>
          <h1>{pageTitle}</h1>
          <span className="public-content-hero-mark" aria-hidden="true">B</span>
        </div>
      </section>
      <div className="container public-content-wrap">
        <article className="public-content-article">
          <aside className="public-content-aside">
            <span className="public-content-aside-number">B.</span>
            <span>BACKSTAGE</span>
            <i />
            <a href="/">العودة للرئيسية <b aria-hidden="true">←</b></a>
          </aside>
          <div className="public-content-copy" dir="auto">
            {paragraphs.length
              ? paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>)
              : <p>هذه الصفحة قيد الإعداد.</p>}
          </div>
        </article>
      </div>
      <footer className="public-content-footer">
        <div className="container">
          <a href="/">BACKSTAGE <span>— حكايات نابضة بالحياة</span></a>
          <nav aria-label="صفحات الموقع">
            {pages.map((item) => <a href={`/pages/${encodeURIComponent(String(item.slug))}`} key={item._id.toString()}>{getPublicPageLabel(String(item.title), String(item.slug))}</a>)}
            <a href="/cast">طاقم العمل</a>
            <a href="/bookings">حجوزاتي</a>
          </nav>
          <span>© 2025 BACKSTAGE</span>
        </div>
      </footer>
    </main>
  );
}
