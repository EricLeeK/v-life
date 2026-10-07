import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { ArcScope } from "@/components/arc/ArcScope";
import { ClockPicker } from "@/components/arc/ClockPicker";
import DateRangePicker, { type DateRange, type DateRangePreset } from "@/vendor/uiarc/registry/components/date-range-picker/date-range-picker";

function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Opens a floating field upward when the space below it is too short for its panel. */
function useFloatingPlacement(rootRef: RefObject<HTMLElement>, needed: number) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const place = () => {
      const open = root.querySelector("[data-open]");
      if (!open) {
        root.classList.remove("date-field-up");
        return;
      }
      const spaceBelow = window.innerHeight - open.getBoundingClientRect().bottom;
      root.classList.toggle("date-field-up", spaceBelow < needed);
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(root, { attributes: true, subtree: true, attributeFilter: ["data-open"] });
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [needed, rootRef]);
}

function formatISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function DateField({
  id,
  label,
  value,
  onChange,
  startValue,
  onRangeChange,
  placeholder,
  min,
  max,
  required = false,
  inline = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  startValue?: string;
  onRangeChange?: (range: { start: string; end: string }) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  required?: boolean;
  inline?: boolean;
}) {
  const { lang, t } = useLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseISODate(value);
  const start = startValue ? parseISODate(startValue) : selected;
  const minDate = min ? parseISODate(min) ?? undefined : undefined;
  const maxDate = max ? parseISODate(max) ?? undefined : undefined;
  const presets: DateRangePreset[] = [
    { label: t("今天", "Today"), range: (today) => ({ start: today, end: today }) },
    {
      label: t("昨天", "Yesterday"),
      range: (today) => {
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        return { start: yesterday, end: yesterday };
      },
    },
  ];

  useLayoutEffect(() => {
    const button = rootRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']");
    if (button && id) button.id = id;
  }, [id, value]);

  useFloatingPlacement(rootRef, 420);

  const apply = (range: DateRange) => {
    if (onRangeChange) {
      onRangeChange({ start: formatISODate(range.start), end: formatISODate(range.end) });
    } else {
      onChange(formatISODate(range.end));
    }
  };

  return (
    <ArcScope ref={rootRef} className={inline ? "date-field date-field-inline" : "date-field"}>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
      )}
      <DateRangePicker
        value={selected ? { start: start ?? selected, end: selected } : null}
        onChange={apply}
        label={label}
        placeholder={placeholder ?? t("选择日期", "Select a date")}
        presets={presets}
        minDate={minDate}
        maxDate={maxDate}
        locale={lang === "zh" ? "zh-CN" : "en-US"}
        weekStartsOn={1}
        months={1}
      />
    </ArcScope>
  );
}

/** A clock-face time picker that shares the date field's material and placement. Value is `HH:mm` or empty. */
export function TimeField({
  id,
  label,
  value,
  onChange,
  clearable = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
}) {
  const { t } = useLang();
  const rootRef = useRef<HTMLDivElement>(null);
  useFloatingPlacement(rootRef, 400);
  return (
    <ArcScope ref={rootRef} className="date-field">
      <ClockPicker
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        clearable={clearable}
        text={{
          placeholder: "--:--",
          hour: t("小时", "Hour"),
          minute: t("分钟", "Minute"),
          now: t("现在", "Now"),
          clear: t("清除", "Clear"),
          cancel: t("取消", "Cancel"),
          done: t("完成", "Done"),
        }}
      />
    </ArcScope>
  );
}

/** Date plus clock. A date without a time stays as `yyyy-mm-dd` until both parts exist. */
export function DateTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLang();
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(value);
  const date = match?.[1] ?? "";
  const time = match?.[2] ?? "";
  const [clock, setClock] = useState(time);
  const shownTime = time || clock;

  useEffect(() => {
    setClock(time);
  }, [time]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-start gap-2">
      <DateField
        id={id}
        label={label}
        value={date}
        onChange={(next) => onChange(next ? (shownTime ? `${next}T${shownTime}` : next) : "")}
      />
      <TimeField
        label={t("时间", "Time")}
        value={shownTime}
        clearable
        onChange={(nextTime) => {
          setClock(nextTime);
          onChange(date ? (nextTime ? `${date}T${nextTime}` : date) : "");
        }}
      />
    </div>
  );
}
