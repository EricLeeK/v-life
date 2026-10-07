import { useState } from "react";
import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { HairlineFigure } from "@/components/concepts/HairlineFigure";
import { conceptCatalog } from "@/components/concepts/catalog";
import { Button } from "@/components/ui/button";
import "@/styles/hairline-design.css";

const chapters = Object.values(conceptCatalog);
const previewHref = (path: string, state: string) => {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("design-state", state);
  return `${url.pathname}${url.search}${url.hash}`;
};

export default function HairlineDesign() {
  const [state, setState] = useState<"empty" | "populated">("empty");
  const { resolvedTheme, setTheme } = useTheme();
  return <main className="hairline-design">
    <header className="design-masthead">
      <a href="/?design-state=populated" className="heading-font">V-Life</a>
      <span>Hairline · 界面设计试验</span>
      <Button variant="ghost" size="icon" aria-label="切换明暗主题" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
        {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </Button>
    </header>
    <section className="design-intro design-intro-catalog">
      <div className="design-intro-copy">
        <h1 className="heading-font">各有形状，<br />各有回应。</h1>
        <p className="design-lead">{chapters.length} 个板块，{chapters.length} 种独立的生活意象。<br />鼠标靠近，各自回应；移开，自然归位。</p>
        <a className="design-browse" href="#design-modules">浏览板块<ArrowUpRight size={16} /></a>
      </div>
    </section>
    <div className="design-section-heading" id="design-modules">
      <div><h2 className="heading-font">逐个板块，看它落在哪里</h2><p>打开页面后，可在顶部切换无数据与有数据。试验使用本地演示记录。</p></div>
      <div className="design-state-toggle" aria-label="预览的数据状态">
        <button type="button" aria-pressed={state === "empty"} onClick={() => setState("empty")}>无数据</button>
        <button type="button" aria-pressed={state === "populated"} onClick={() => setState("populated")}>有数据</button>
      </div>
    </div>
    <div className="design-chapters">
      {chapters.map(chapter => <article className="design-chapter" key={chapter.figure}>
        <div className="design-chapter-art"><HairlineFigure name={chapter.figure} /></div>
        <div className="design-chapter-body">
          <h3 className="heading-font">{chapter.title} · {chapter.metaphor}</h3>
          <p>{chapter.gesture}</p>
          <a href={previewHref(chapter.path, state)}>打开{chapter.title}<ArrowUpRight size={16} /></a>
        </div>
      </article>)}
    </div>
  </main>;
}
