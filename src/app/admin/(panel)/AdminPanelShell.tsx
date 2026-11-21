"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  { href: "/admin", label: "لوحة التحكم", icon: "◈" },
  { href: "/admin/bookings", label: "الحجوزات والدفع", icon: "▤" },
  { href: "/admin/checkin", label: "بوابة المسرح", icon: "✓" },
  { href: "/admin/shows", label: "العروض والليالي", icon: "✦" },
  { href: "/admin/content", label: "محتوى الموقع", icon: "▧" },
  { href: "/admin/branding", label: "هوية العلامة", icon: "◉" },
  { href: "/admin/settings", label: "إعدادات المنصة", icon: "⚙" },
  { href: "/admin/account", label: "الحساب والأمان", icon: "⌑" },
];

type AdminPanelShellProps = Readonly<{
  children: React.ReactNode;
  databaseConfigured: boolean;
}>;

export default function AdminPanelShell({ children, databaseConfigured }: AdminPanelShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 820px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);

  const activeSection = navigation.find((item) =>
    item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href),
  );
  const frameClassName = [
    "admin-frame",
    collapsed && !isMobile ? "is-collapsed" : "",
    drawerOpen ? "is-drawer-open" : "",
  ].filter(Boolean).join(" ");

  function toggleNavigation() {
    if (isMobile) setDrawerOpen((open) => !open);
    else setCollapsed((isCollapsed) => !isCollapsed);
  }

  async function logout() {
    if (isLoggingOut) return;
    setLogoutError("");
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout request failed");
      window.location.replace("/admin/login");
    } catch {
      setLogoutError("تعذر تسجيل الخروج. حاول مرة أخرى.");
      setIsLoggingOut(false);
    }
  }

  return (
    <div className={frameClassName}>
      <button
        className="admin-drawer-backdrop"
        type="button"
        aria-label="إغلاق القائمة الجانبية"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className="admin-sidebar" id="admin-sidebar" aria-label="القائمة الجانبية">
        <div className="admin-sidebar-heading">
          <Link className="admin-brand" href="/admin" onClick={() => setDrawerOpen(false)}>
            <span className="admin-brand-mark">B</span>
            <span className="admin-brand-copy">
              <strong>BACKSTAGE</strong>
              <small>إدارة المنصة</small>
            </span>
          </Link>
          <button
            className="admin-drawer-close"
            type="button"
            aria-label="إغلاق القائمة الجانبية"
            onClick={() => setDrawerOpen(false)}
          >
            ×
          </button>
        </div>
        <p className="admin-nav-caption">إدارة المنصة</p>
        <nav className="admin-nav" aria-label="قائمة لوحة الإدارة">
          {navigation.map((item) => {
            const isActive = item.href === "/admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                className={`admin-nav-link${isActive ? " is-active" : ""}`}
                href={item.href}
                key={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                onClick={() => setDrawerOpen(false)}
              >
                <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                <span className="admin-nav-label">{item.label}</span>
                {isActive && <span className="admin-nav-indicator" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-connection">
            <span className={`admin-status-dot${databaseConfigured ? " is-connected" : ""}`} />
            <span className="admin-sidebar-status">
              {databaseConfigured ? "قاعدة البيانات متصلة" : "وضع العرض التجريبي"}
            </span>
          </div>
          <button
            className="admin-logout-button"
            type="button"
            onClick={logout}
            disabled={isLoggingOut}
            aria-label={isLoggingOut ? "جارٍ تسجيل الخروج" : "تسجيل الخروج"}
          >
            <span className="admin-logout-icon" aria-hidden="true">↩</span>
            <span className="admin-logout-label">
              {isLoggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}
            </span>
          </button>
          {logoutError && <p className="admin-logout-error" role="alert">{logoutError}</p>}
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-start">
            <button
              className="admin-menu-toggle"
              type="button"
              aria-label={isMobile
                ? (drawerOpen ? "إغلاق القائمة الجانبية" : "فتح القائمة الجانبية")
                : (collapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية")}
              aria-controls="admin-sidebar"
              aria-expanded={isMobile ? drawerOpen : !collapsed}
              onClick={toggleNavigation}
            >
              <span aria-hidden="true">{isMobile && drawerOpen ? "×" : "☰"}</span>
            </button>
            <div className="admin-topbar-title">
              <span className="admin-topbar-eyebrow">BACKSTAGE / ADMIN</span>
              <strong>{activeSection?.label || "إدارة المنصة"}</strong>
            </div>
          </div>
          <Link className="admin-site-link" href="/">
            عرض الموقع <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
