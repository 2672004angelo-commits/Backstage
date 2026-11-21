const pageLabelsBySlug = new Map([
  ["about-us", "من نحن"],
  ["abuot-us", "من نحن"],
  ["about", "من نحن"],
  ["contact", "تواصل معنا"],
  ["contact-us", "تواصل معنا"],
]);

export function getPublicPageLabel(title: string, slug: string) {
  return pageLabelsBySlug.get(slug.toLowerCase()) || title;
}
