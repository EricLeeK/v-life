import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "zh" | "en";

interface LangCtx {
  lang: Lang;
  toggleLang: () => void;
  t: (zh: string, en: string) => string;
}

const LangContext = createContext<LangCtx>({ lang: "zh", toggleLang: () => {}, t: (zh: string) => zh });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "zh";
    return (localStorage.getItem("vlife-lang") as Lang) || "zh";
  });

  useEffect(() => {
    localStorage.setItem("vlife-lang", lang);
  }, [lang]);

  const toggleLang = () => setLang((l) => (l === "zh" ? "en" : "zh"));
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);

  return <LangContext.Provider value={{ lang, toggleLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
