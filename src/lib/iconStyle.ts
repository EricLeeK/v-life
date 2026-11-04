import { useSyncExternalStore } from "react";

export const iconStyles = [
  { value: "colorful", zh: "彩色", en: "Colorful" },
  { value: "apricot", zh: "杏色", en: "Apricot" },
  { value: "bluegray", zh: "蓝灰", en: "Blue-gray" },
  { value: "minimal", zh: "简约风", en: "Minimal" },
] as const;
export type IconStyle = typeof iconStyles[number]["value"];
const key = "vlife-icon-style";
const listeners = new Set<() => void>();
function parse(value: string | null): IconStyle {
  return iconStyles.find(option => option.value === value)?.value ?? "colorful";
}
function read(): IconStyle {
  try { return parse(localStorage.getItem(key)); } catch { return "colorful"; }
}
let current = read();
function notify(next: IconStyle) {
  if (next === current) return;
  current = next;
  listeners.forEach(listener => listener());
}
function onStorage(event: StorageEvent) {
  if (event.key === key || event.key === null) notify(read());
}
function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}
export function setIconStyle(value: string) {
  const next = parse(value);
  try { localStorage.setItem(key, next); } catch { /* Keep the choice for this session. */ }
  notify(next);
}
export const getIconStyle = () => current;

export function useIconStyle() {
  return useSyncExternalStore<IconStyle>(subscribe, getIconStyle, () => "colorful");
}
