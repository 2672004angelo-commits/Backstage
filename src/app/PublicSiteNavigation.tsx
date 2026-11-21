"use client";

import { useEffect, useState } from "react";
import LanguageToggle from "./LanguageToggle";

type PublicPageLink = { id: string; title: string; slug: string };

export default function PublicSiteNavigation({
  pages,
  activePath,
}: {
  pages: PublicPageLink[];
  activePath: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const links = [
    { href: "/", label: "الرئيسية" },
    { href: "/#shows", label: "العروض" },
    { href: "/cast", label: "طاقم العمل" },
    ...pages.map((page) => ({ href: `/pages/${encodeURIComponent(page.slug)}`, label: page.title })),
    { href: "/bookings", label: "حجوزاتي" },
  ];

  return (
    <div className="public-navigation">
      <button
        className="public-menu-toggle"
        type="button"
        aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
        aria-expanded={open}
        aria-controls="public-main-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
        <span>{open ? "إغلاق" : "القائمة"}</span>
      </button>
      {open && (
        <button
          className="public-nav-backdrop"
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
        />
      )}
      <nav
        className={`public-nav${open ? " is-open" : ""}`}
        id="public-main-navigation"
        aria-label="التنقل الرئيسي"
        aria-hidden={!open && undefined}
      >
        {open && (
          <div className="public-nav-heading">
            <strong>استكشف BACKSTAGE</strong>
            <button type="button" aria-label="إغلاق القائمة" onClick={() => setOpen(false)}>×</button>
          </div>
        )}
        {links.map((link) => (
          <a
            href={link.href}
            key={link.href}
            aria-current={activePath === link.href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <LanguageToggle />
      </nav>
    </div>
  );
}
