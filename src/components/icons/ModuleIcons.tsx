import { useLayoutEffect, useRef } from "react";
import * as LineIcons from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { mountIcon, go, clearTone, runtime } from "@/vendor/kubai/engine.js";
import { icons } from "@/vendor/kubai/icons.js";
import { productIcons } from "./productIcons.js";
import { getIconStyle, useIconStyle, type IconStyle } from "@/lib/iconStyle";
import "./module-icons.css";

const drawings = new Map([...icons, ...productIcons].map(icon => [icon.name, icon]));
const tones = {
  apricot: clearTone("杏色", "#C9946A", 1),
  bluegray: clearTone("蓝灰", "#6F87B5", 1),
};
runtime.palette = { colors: {}, edges: {}, deepMarks: false };
let nextId = 0;

function paint(id: number, accent: string, style: IconStyle) {
  const tone = style === "apricot" || style === "bluegray" ? tones[style] : null;
  runtime.palette.deepMarks = Boolean(tone);
  runtime.palette.colors[id] = tone?.colors[0] ?? accent;
  runtime.palette.edges[id] = tone?.edges[0] ?? accent;
}

function moduleIcon(Line: LucideIcon, name: string) {
  const drawing = drawings.get(name);
  return function ModuleIcon({ className, size = 24, style, ...props }: LucideProps) {
    const mode = useIconStyle();
    const host = useRef<HTMLSpanElement>(null);
    const instance = useRef<ReturnType<typeof mountIcon> | null>(null);
    const colorful = mode !== "minimal";

    useLayoutEffect(() => {
      if (!colorful || !host.current) return;
      const id = nextId++;
      // Initialize before mounting because the renderer paints the first frame immediately.
      paint(id, drawing.accent, getIconStyle());
      const icon = mountIcon(drawing, id, host.current);
      instance.current = icon;
      const control = host.current.closest("a, button, [tabindex]") || host.current;
      let hovered = false;
      let focused = false;
      const update = () => { icon.hover = Number(hovered || focused); go(icon); };
      const enter = () => { hovered = true; update(); };
      const leave = () => { hovered = false; update(); };
      const focus = () => { focused = true; update(); };
      const blur = () => { focused = false; update(); };
      control.addEventListener("pointerenter", enter);
      control.addEventListener("pointerleave", leave);
      control.addEventListener("focusin", focus);
      control.addEventListener("focusout", blur);
      return () => {
        control.removeEventListener("pointerenter", enter);
        control.removeEventListener("pointerleave", leave);
        control.removeEventListener("focusin", focus);
        control.removeEventListener("focusout", blur);
        cancelAnimationFrame(icon.raf);
        delete runtime.palette.colors[id];
        delete runtime.palette.edges[id];
        instance.current = null;
      };
    }, [colorful]);

    useLayoutEffect(() => {
      const icon = instance.current;
      if (!icon) return;
      const previous = runtime.palette.colors[icon.i];
      paint(icon.i, drawing.accent, mode);
      if (previous !== runtime.palette.colors[icon.i]) go(icon);
    }, [mode]);

    if (!colorful) return <Line className={className} size={size} style={style} {...props} />;
    return <span ref={host} aria-hidden="true" data-kubai-icon={name}
      className={`module-artwork ${className ?? ""}`} style={{ ...style, width: size, height: size }} />;
  };
}

export const LayoutDashboard = moduleIcon(LineIcons.LayoutDashboard, "主页");
export const CalendarDays = moduleIcon(LineIcons.CalendarDays, "日历");
export const CalendarCheck = moduleIcon(LineIcons.CalendarCheck, "日历");
export const CalendarPlus = moduleIcon(LineIcons.CalendarPlus, "日历");
export const CheckSquare = moduleIcon(LineIcons.CheckSquare, "剪贴板");
export const ListPlus = moduleIcon(LineIcons.ListPlus, "剪贴板");
export const Wallet = moduleIcon(LineIcons.Wallet, "钱包");
export const Package = moduleIcon(LineIcons.Package, "包裹");
export const Newspaper = moduleIcon(LineIcons.Newspaper, "文档");
export const ReceiptText = moduleIcon(LineIcons.ReceiptText, "文档");
export const Kanban = moduleIcon(LineIcons.Kanban, "文件夹");
export const Target = moduleIcon(LineIcons.Target, "旗帜");
export const Lightbulb = moduleIcon(LineIcons.Lightbulb, "灯泡");
export const BookOpen = moduleIcon(LineIcons.BookOpen, "书本");
export const Sparkles = moduleIcon(LineIcons.Sparkles, "星标");
export const Settings = moduleIcon(LineIcons.Settings, "设置");
export const ShoppingBag = moduleIcon(LineIcons.ShoppingBag, "购物车");
export const LogOut = moduleIcon(LineIcons.LogOut, "退出");
export const Clock = moduleIcon(LineIcons.Clock, "时钟");
export const Timer = moduleIcon(LineIcons.Timer, "闹钟");
export const Flame = moduleIcon(LineIcons.Flame, "热焰");
export const Carrot = moduleIcon(LineIcons.Carrot, "胡萝卜");
export const Scale = moduleIcon(LineIcons.Scale, "体重秤");
export const TrendingDown = moduleIcon(LineIcons.TrendingDown, "体重秤");
export const Languages = moduleIcon(LineIcons.Languages, "双语字卡");
