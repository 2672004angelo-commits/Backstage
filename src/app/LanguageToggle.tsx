"use client";

import { useEffect, useState } from "react";
import type { Language } from "./locale";

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
      window.dispatchEvent(new CustomEvent<Language>("backstage-language-change", { detail: next }));
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
