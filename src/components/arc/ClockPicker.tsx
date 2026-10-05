import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, FocusEvent as ReactFocusEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { Transition, Variants } from "motion/react";
import { ChevronDown, Clock3 } from "lucide-react";
import { motionTokens } from "@/lib/motion-tokens";
import styles from "./clock-picker.module.css";

type Bezier = [number, number, number, number];
type Mode = "hour" | "minute";
type Time = { h: number; m: number };

export interface ClockPickerText {
  placeholder: string;
  hour: string;
  minute: string;
  now: string;
  clear: string;
  cancel: string;
  done: string;
}

export interface ClockPickerProps {
  /** `HH:mm`, or empty for no time. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  text: ClockPickerText;
  clearable?: boolean;
  id?: string;
}

/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps its velocity. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = 2 * Math.PI / (visualDuration * 1.2);
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 };
};
const GROW = physical(.48, .12), SHRINK = physical(.38, 0), HAND = physical(.32, .16);
const enterEase = [...motionTokens.ease.enter] as Bezier;
const standardEase = [...motionTokens.ease.standard] as Bezier;
const TRIGGER_RADIUS = 18, PANEL_RADIUS = 26, EDGE = 8;
const FACE = 240, C = FACE / 2, OUTER = 98, INNER = 64, KNOB = 34;

const pad = (n: number) => String(n).padStart(2, "0");
const parse = (value: string): Time | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]);
  return h < 24 && m < 60 ? { h, m } : null;
};
const nowTime = (): Time => { const d = new Date(); return { h: d.getHours(), m: d.getMinutes() }; };

/** Hours ride two rings: 1–12 outside, 13–00 inside, each at its own clock position. */
const hourAngle = (h: number) => (h % 12) * 30;
const hourRing = (h: number) => (h === 0 || h > 12 ? INNER : OUTER);
const minuteAngle = (m: number) => m * 6;

const faceSwap: Variants = {
  enter: (dir: number) => ({ opacity: 0, scale: dir > 0 ? 1.08 : .92, filter: "blur(3px)" }),
  center: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: .28, ease: enterEase } },
  exit: (dir: number) => ({ opacity: 0, scale: dir > 0 ? .92 : 1.08, filter: "blur(3px)", transition: { duration: .16, ease: standardEase } }),
};
const roll: Variants = {
  enter: (dir: number) => ({ y: `${dir * .5}em`, opacity: 0 }),
  center: { y: "0em", opacity: 1, transition: { duration: .24, ease: enterEase } },
  exit: (dir: number) => ({ y: `${dir * -.5}em`, opacity: 0, transition: { duration: .14, ease: standardEase } }),
};
const faceIn: Variants = {
  hidden: { opacity: 0, y: -4, filter: "blur(2px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: .26, ease: enterEase, delay: .07 } },
  gone: { opacity: 0, y: -2, filter: "blur(2px)", transition: { duration: .12, ease: standardEase } },
};

function Digits({ value, reduced }: { value: number; reduced: boolean }) {
  const last = useRef(value);
  const dir = value === last.current ? 0 : value > last.current ? 1 : -1;
  useEffect(() => { last.current = value; }, [value]);
  return (
    <span className={styles.digits}>
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <motion.span key={value} custom={dir} variants={reduced ? undefined : roll} initial="enter" animate="center" exit="exit" className={styles.digitsInner}>
          {pad(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A clock face: drag or tap the hand, hours on two rings, then minutes. The trigger grows into the panel and back. */
export function ClockPicker({ value, onChange, label, text, clearable = false, id }: ClockPickerProps) {
  const uid = useId();
  const reduced = !!useReducedMotion();
  const committed = parse(value);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("hour");
  const [draft, setDraft] = useState<Time>(committed ?? { h: 9, m: 0 });
  const modeDir = mode === "minute" ? 1 : -1;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pendingFocus = useRef<"trigger" | "face" | null>(null);

  /* ---------- One surface: the trigger's box springs to the panel's box and back ---------- */
  const width = useMotionValue<number | string>("100%"), height = useMotionValue<number | string>("100%");
  const radius = useMotionValue(TRIGGER_RADIUS), x = useMotionValue(0);
  const sizes = useRef<{ trigger: { w: number; h: number }; panel: { w: number; h: number } | null }>({ trigger: { w: 0, h: 0 }, panel: null });
  const live = useRef({ open: false, ready: false });

  const update = useCallback(() => {
    const { trigger, panel } = sizes.current;
    if (!trigger.w) return;
    const openPanel = live.current.open && panel ? panel : null;
    const target = openPanel ?? trigger;
    let offset = 0;
    if (openPanel && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect(), right = document.documentElement.clientWidth;
      offset = Math.max(EDGE - rect.left, Math.min(0, right - EDGE - (rect.left + openPanel.w)));
    }
    const r = openPanel ? PANEL_RADIUS : TRIGGER_RADIUS;
    if (!live.current.ready || reduced) {
      width.jump(target.w); height.jump(target.h); radius.jump(r); x.jump(offset);
      live.current.ready = true;
      return;
    }
    const spring = openPanel ? GROW : SHRINK;
    animate(width, target.w, spring); animate(height, target.h, spring); animate(radius, r, spring); animate(x, offset, spring);
  }, [height, radius, reduced, width, x]);

  useLayoutEffect(() => { live.current.open = open; if (!open) sizes.current.panel = null; queueMicrotask(update); }, [open, update]);

  useLayoutEffect(() => {
    const node = triggerRef.current;
    if (!node) return;
    const read = () => { sizes.current.trigger = { w: node.offsetWidth, h: node.offsetHeight }; queueMicrotask(update); };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [update]);

  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!open || !node) return;
    const read = () => { sizes.current.panel = { w: node.offsetWidth, h: node.offsetHeight }; queueMicrotask(update); };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, update]);

  /* ---------- The hand: angle unwraps to the shortest turn, length follows the ring ---------- */
  const angle = useMotionValue(hourAngle(draft.h));
  const length = useMotionValue(hourRing(draft.h));
  const knobX = useTransform([angle, length], ([a, l]: number[]) => C + l * Math.sin(a * Math.PI / 180) - KNOB / 2);
  const knobY = useTransform([angle, length], ([a, l]: number[]) => C - l * Math.cos(a * Math.PI / 180) - KNOB / 2);
  const handLength = useTransform(length, l => l - KNOB / 2);

  const aim = useCallback((targetAngle: number, targetLength: number, jump = false) => {
    const current = angle.get();
    const delta = ((targetAngle - current) % 360 + 540) % 360 - 180;
    if (jump || reduced) { angle.jump(current + delta); length.jump(targetLength); return; }
    animate(angle, current + delta, HAND);
    animate(length, targetLength, HAND);
  }, [angle, length, reduced]);

  useEffect(() => {
    if (mode === "hour") aim(hourAngle(draft.h), hourRing(draft.h));
    else aim(minuteAngle(draft.m), OUTER);
  }, [aim, draft.h, draft.m, mode]);

  /* ---------- Open, close, commit ---------- */
  const openPanel = () => {
    const start = committed ?? nowTime();
    setDraft(start);
    setMode("hour");
    aim(hourAngle(start.h), hourRing(start.h), true);
    pendingFocus.current = "face";
    setOpen(true);
  };
  const close = useCallback((focus: boolean) => {
    if (focus) pendingFocus.current = "trigger";
    setOpen(false);
  }, []);
  const commit = () => { onChange(`${pad(draft.h)}:${pad(draft.m)}`); close(true); };

  useLayoutEffect(() => {
    if (pendingFocus.current === "trigger" && !open) { pendingFocus.current = null; triggerRef.current?.focus({ preventScroll: true }); }
    if (pendingFocus.current === "face" && open && faceRef.current) { pendingFocus.current = null; faceRef.current.focus({ preventScroll: true }); }
  });

  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(false); };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [close, open]);

  useLayoutEffect(() => {
    const button = triggerRef.current;
    if (button && id) button.id = id;
  }, [id]);

  /* ---------- Pointer: the hand follows the finger and snaps to whole hours or minutes ---------- */
  const pick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - rect.left - C, dy = event.clientY - rect.top - C;
    const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    if (mode === "hour") {
      const slot = Math.round(deg / 30) % 12;
      const inner = Math.hypot(dx, dy) < (OUTER + INNER) / 2;
      const h = inner ? (slot === 0 ? 0 : slot + 12) : (slot === 0 ? 12 : slot);
      setDraft(d => (d.h === h ? d : { ...d, h }));
    } else {
      const m = Math.round(deg / 6) % 60;
      setDraft(d => (d.m === m ? d : { ...d, m }));
    }
  };
  const onFaceDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    pick(event);
  };
  const onFaceMove = (event: ReactPointerEvent<HTMLDivElement>) => { if (dragging.current) pick(event); };
  const onFaceUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (mode === "hour") window.setTimeout(() => setMode("minute"), reduced ? 0 : 140);
  };

  const onFaceKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[event.key];
    if (step) {
      event.preventDefault();
      setDraft(d => mode === "hour" ? { ...d, h: (d.h + step + 24) % 24 } : { ...d, m: (d.m + step + 60) % 60 });
      return;
    }
    if (event.key === "Enter") { event.preventDefault(); if (mode === "hour") setMode("minute"); else commit(); }
  };

  const onRootKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(true); }
  };
  const onRootBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (open && next && !event.currentTarget.contains(next)) close(false);
  };

  /* ---------- Face content ---------- */
  const slots = Array.from({ length: 12 }, (_, i) => i);
  const place = (i: number, r: number) => ({ left: C + r * Math.sin(i * Math.PI / 6), top: C - r * Math.cos(i * Math.PI / 6) });
  const numbers = mode === "hour"
    ? [
      ...slots.map(i => ({ key: `o${i}`, v: i === 0 ? 12 : i, r: OUTER, inner: false })),
      ...slots.map(i => ({ key: `i${i}`, v: i === 0 ? 0 : i + 12, r: INNER, inner: true })),
    ]
    : slots.map(i => ({ key: `m${i}`, v: i * 5, r: OUTER, inner: false }));
  const selected = mode === "hour" ? draft.h : draft.m;
  const onLabel = mode === "hour" || draft.m % 5 === 0;

  const quiet = open ? { opacity: 0, filter: "blur(2px)" } : { opacity: 1, filter: "blur(0px)" };
  const quietTransition = open ? { duration: .12, ease: standardEase } : { duration: .22, ease: enterEase, delay: reduced ? 0 : .1 };
  const shownValue = committed ? `${pad(committed.h)}:${pad(committed.m)}` : text.placeholder;

  return (
    <div ref={rootRef} className={styles.root} data-open={open || undefined} onKeyDown={onRootKey} onBlur={onRootBlur}>
      <button ref={triggerRef} type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open}
        aria-controls={open ? `${uid}-panel` : undefined} aria-label={`${label}: ${shownValue}`} inert={open || undefined} onClick={openPanel}>
        <motion.span className={styles.icon} initial={false} animate={quiet} transition={quietTransition}><Clock3 size={16} strokeWidth={1.75} aria-hidden="true" /></motion.span>
        <motion.span className={styles.value} data-empty={!committed || undefined} initial={false} animate={quiet} transition={quietTransition}>{shownValue}</motion.span>
        <motion.span className={styles.chevron} initial={false} animate={quiet} transition={quietTransition}><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></motion.span>
      </button>

      <motion.div className={styles.surface} style={{ width, height, borderRadius: radius, x }}>
        <AnimatePresence>
          {open && (
            <motion.div key="panel" ref={panelRef} id={`${uid}-panel`} className={styles.panel} role="dialog" aria-label={label}
              exit={{ opacity: 1, transition: { duration: .14 } }}>
              <motion.div variants={faceIn} initial="hidden" animate="shown" exit="gone">
                <div className={styles.readout}>
                  <button type="button" className={styles.segment} aria-pressed={mode === "hour"} aria-label={text.hour} onClick={() => setMode("hour")}>
                    <Digits value={draft.h} reduced={reduced} />
                  </button>
                  <span className={styles.colon} aria-hidden="true">:</span>
                  <button type="button" className={styles.segment} aria-pressed={mode === "minute"} aria-label={text.minute} onClick={() => setMode("minute")}>
                    <Digits value={draft.m} reduced={reduced} />
                  </button>
                </div>

                <div ref={faceRef} className={styles.face} tabIndex={0} role="slider"
                  aria-label={mode === "hour" ? text.hour : text.minute}
                  aria-valuemin={0} aria-valuemax={mode === "hour" ? 23 : 59} aria-valuenow={selected} aria-valuetext={pad(selected)}
                  onPointerDown={onFaceDown} onPointerMove={onFaceMove} onPointerUp={onFaceUp} onPointerCancel={onFaceUp} onKeyDown={onFaceKey}>
                  <svg className={styles.ticks} width={FACE} height={FACE} aria-hidden="true">
                    {Array.from({ length: 60 }, (_, i) => {
                      const major = i % 5 === 0, a = i * Math.PI / 30, r1 = C - 3, r2 = C - (major ? 9 : 6);
                      return <line key={i} x1={C + r1 * Math.sin(a)} y1={C - r1 * Math.cos(a)} x2={C + r2 * Math.sin(a)} y2={C - r2 * Math.cos(a)} data-major={major || undefined} />;
                    })}
                  </svg>
                  <motion.span className={styles.hand} style={{ height: handLength, rotate: angle }} aria-hidden="true" />
                  <span className={styles.pivot} aria-hidden="true" />
                  <motion.span className={styles.knob} style={{ x: knobX, y: knobY }} data-dot={!onLabel || undefined} aria-hidden="true" />
                  <AnimatePresence initial={false} custom={modeDir} mode="popLayout">
                    <motion.div key={mode} className={styles.numbers} custom={modeDir} variants={reduced ? undefined : faceSwap} initial="enter" animate="center" exit="exit" aria-hidden="true">
                      {numbers.map(({ key, v, r, inner }, i) => (
                        <span key={key} className={styles.number} data-inner={inner || undefined} data-on={v === selected || undefined}
                          style={place(i % 12, r)}>
                          {mode === "minute" ? pad(v) : v === 0 ? "00" : v}
                        </span>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className={styles.footer}>
                  <div className={styles.quick}>
                    <button type="button" className={styles.ghost} onClick={() => setDraft(nowTime())}>{text.now}</button>
                    {clearable && committed && <button type="button" className={styles.ghost} onClick={() => { onChange(""); close(true); }}>{text.clear}</button>}
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={styles.ghost} onClick={() => close(true)}>{text.cancel}</button>
                    <button type="button" className={styles.primary} onClick={commit}>{text.done}</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
