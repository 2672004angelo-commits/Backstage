"use client";

import { useEffect, useState } from "react";

const translations: Record<string, string> = {
  "الرئيسية": "Home",
  "العروض": "Shows",
  "طاقم العمل": "Cast",
  "حجوزاتي": "My bookings",
  "عروض قادمة": "Upcoming shows",
  "على خشبة المسرح": "On stage",
  "دخول الإدارة": "Admin login",
  "لوحة التحكم": "Dashboard",
  "الحجوزات والتذاكر": "Bookings & tickets",
  "الحجوزات والدفع": "Bookings & payment",
  "بوابة المسرح": "Theatre gate",
  "العروض والليالي": "Shows & nights",
  "محتوى الموقع": "Site content",
  "هوية العلامة": "Brand identity",
  "إعدادات المنصة": "Platform settings",
  "الحساب والأمان": "Account & security",
  "تسجيل الخروج": "Log out",
  "عرض الموقع": "View site",
};

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const [language, setLanguage] = useState<"ar" | "en">("ar");

  useEffect(() => {
    const saved = window.localStorage.getItem("backstage-language");
    setLanguage(saved === "en" ? "en" : "ar");
  }, []);

  useEffect(() => {
    const apply = (next: "ar" | "en") => {
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      window.localStorage.setItem("backstage-language", next);
      document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
        if (element.children.length) return;
        const text = element.textContent?.trim();
        if (!text) return;
        if (next === "en" && translations[text]) element.textContent = translations[text];
        if (next === "ar") {
          const entry = Object.entries(translations).find(([, translated]) => translated === text);
          if (entry) element.textContent = entry[0];
        }
      });
    };
    apply(language);
  }, [language]);

  return (
    <button
      type="button"
      className={`language-toggle ${className}`}
      aria-label={language === "ar" ? "Switch to English" : "Switch to Arabic"}
      onClick={() => setLanguage((current) => current === "ar" ? "en" : "ar")}
    >
      {language === "ar" ? "EN" : "عربي"}
    </button>
  );
}
