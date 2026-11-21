"use client";

import { useEffect } from "react";
import { applyLanguage, observeLanguage, type Language } from "./locale";

export default function LanguageRuntime() {
  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("backstage-language");
    const language: Language = savedLanguage === "en" ? "en" : "ar";
    applyLanguage(language);
    return observeLanguage(language, () => undefined);
  }, []);

  return null;
}
