import { Component, type ReactNode } from "react";
import { useLang } from "@/contexts/LanguageContext";

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function RouteLoadBoundary({ children }: { children: ReactNode }) {
  const { t } = useLang();
  return (
    <Boundary fallback={
      <div role="alert" className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-lg font-semibold">{t("页面暂时无法打开", "This page couldn't open")}</h2>
        <p className="text-sm text-muted-foreground">{t("请检查网络后重试。离线时，尚未缓存的页面需要联网才能打开。", "Check your connection and retry. Pages that aren't cached need an internet connection.")}</p>
        <div className="flex gap-3">
          <button className="min-h-11 rounded-md border px-4 focus-visible:outline focus-visible:outline-2" onClick={() => window.location.reload()}>{t("重新加载", "Reload")}</button>
          <a className="min-h-11 rounded-md border px-4 inline-flex items-center focus-visible:outline focus-visible:outline-2" href="/">{t("返回首页", "Back to home")}</a>
        </div>
      </div>
    }>
      {children}
    </Boundary>
  );
}
