type IconProps = { label: string; url: string };

function platformOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\.|^m\./, "");
    if (host.endsWith("instagram.com")) return "instagram";
    if (host.endsWith("facebook.com") || host.endsWith("fb.com")) return "facebook";
    if (host.endsWith("tiktok.com")) return "tiktok";
    if (host.endsWith("youtube.com") || host.endsWith("youtu.be")) return "youtube";
    if (host === "x.com" || host.endsWith("twitter.com")) return "x";
    if (host.endsWith("whatsapp.com") || host === "wa.me") return "whatsapp";
    if (host === "t.me" || host.endsWith("telegram.me") || host.endsWith("telegram.org")) return "telegram";
  } catch { /* fall through */ }
  return "link";
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Glyph({ platform }: { platform: string }) {
  switch (platform) {
    case "instagram":
      return (<>
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" {...stroke} />
        <circle cx="12" cy="12" r="4.3" {...stroke} />
        <circle cx="17.3" cy="6.7" r="1.3" fill="currentColor" />
      </>);
    case "facebook":
      return <path fill="currentColor" d="M13.6 21v-6.9h2.3l.4-2.9h-2.7V9.3c0-.8.3-1.4 1.5-1.4h1.3V5.2c-.3 0-1.1-.1-2-.1-2.1 0-3.5 1.3-3.5 3.6v2.5H8.5v2.9h2.4V21h2.7z" />;
    case "tiktok":
      return <path fill="currentColor" d="M16.6 3c.4 2.2 1.8 3.6 4.1 3.8v3c-1.6 0-3-.5-4.1-1.3v6.3A5.6 5.6 0 1 1 9.6 9.4c.4 0 .8 0 1.2.1v3.1a2.6 2.6 0 1 0 2.7 2.6V3h3.1z" />;
    case "youtube":
      return (<>
        <rect x="2" y="5.5" width="20" height="13" rx="4" {...stroke} />
        <path fill="currentColor" d="M10 9.3v5.4l4.8-2.7z" />
      </>);
    case "x":
      return <path fill="currentColor" d="M17.7 3h3.1l-6.8 7.8L21.9 21h-6.3l-4.9-6.4L5 21H1.9l7.3-8.3L2.1 3h6.4l4.4 5.9L17.7 3zm-1.1 16.1h1.7L7.4 4.7H5.6l11 14.4z" />;
    case "whatsapp":
      return (<>
        <path {...stroke} d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" />
        <path fill="currentColor" d="M9.3 7.9c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .4-.1.5l-.4.6c-.1.2-.1.3 0 .5.5.8 1.2 1.5 2 1.9.2.1.3.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.5.7c.2.1.4.3.4.5 0 .8-.5 1.5-1.3 1.7-.4.1-.8.1-1.2-.1-2.3-.8-4-2.5-4.9-4.8-.2-.5-.2-.9 0-1.3l.4-1z" />
      </>);
    case "telegram":
      return <path fill="currentColor" d="M21.4 3.6 2.9 10.9c-.9.3-.8 1.5.1 1.7l4.6 1.4 1.7 5.3c.2.8 1.2 1 1.8.4l2.4-2.5 4.3 3.2c.6.5 1.6.1 1.8-.7l2.7-14.6c.2-.9-.6-1.7-1.5-1.5zM8.4 13.5l9.6-6.1c.2-.2.5.2.3.4l-7.7 7.2-.3 3-1.9-4.5z" />;
    default:
      return (<>
        <path {...stroke} d="M10 14a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path {...stroke} d="M14 10a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </>);
  }
}

export default function SocialIcon({ label, url }: IconProps) {
  return (
    <a className="public-social-icon" href={url} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <Glyph platform={platformOf(url)} />
      </svg>
      <span className="visually-hidden">{label}</span>
    </a>
  );
}
