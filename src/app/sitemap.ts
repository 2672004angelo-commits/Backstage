import type { MetadataRoute } from "next";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/cast`, changeFrequency: "weekly", priority: 0.7 },
  ];
  if (!isMongoConfigured()) return entries;

  const db = await getDb();
  const [shows, pages] = await Promise.all([
    db.collection("shows").find({ open: true }).project({ updatedAt: 1 }).limit(500).toArray(),
    db.collection("content_pages").find({ published: true }).project({ slug: 1, updatedAt: 1 }).limit(200).toArray(),
  ]);
  for (const show of shows) {
    entries.push({
      url: `${siteUrl}/shows/${show._id.toString()}`,
      lastModified: show.updatedAt instanceof Date ? show.updatedAt : undefined,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  for (const page of pages) {
    const slug = String(page.slug || "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) continue;
    entries.push({
      url: `${siteUrl}/pages/${encodeURIComponent(slug)}`,
      lastModified: page.updatedAt instanceof Date ? page.updatedAt : undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  return entries;
}
