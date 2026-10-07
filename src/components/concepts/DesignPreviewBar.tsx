import type { DesignPreviewState } from "@/lib/designPreview";
import { useLocation } from "react-router-dom";
import { conceptCatalog } from "./catalog";

const designPages = Object.values(conceptCatalog);

export function DesignPreviewBar({ state }: { state: DesignPreviewState }) {
  const location = useLocation();
  const current = location.pathname + (new URLSearchParams(location.search).has("tab") ? `?tab=${new URLSearchParams(location.search).get("tab")}` : "") + location.hash;
  const go = (path: string, next = state) => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("design-state", next ?? "empty");
    window.location.assign(url.href);
  };
  return <div className="design-preview-bar">
    <a href="/design/hairline">设计试验</a>
    <label className="sr-only" htmlFor="design-page">预览板块</label>
    <select id="design-page" value={current} onChange={event => go(event.target.value)}>
      {!designPages.some(({ path }) => path === current) && <option value={current} disabled>当前页面</option>}
      {designPages.map(({ path, title }) => <option key={path} value={path}>{title}</option>)}
    </select>
    <div className="design-preview-states" aria-label="数据状态">
      <button type="button" aria-pressed={state === "empty"} onClick={() => go(current, "empty")}>无数据</button>
      <button type="button" aria-pressed={state === "populated"} onClick={() => go(current, "populated")}>有数据</button>
    </div>
  </div>;
}
