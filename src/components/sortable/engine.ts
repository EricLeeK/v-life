/**
 * SortableEngine — the interaction layer behind <SortableList>.
 *
 * Ported from the stand-alone drag-reorder prototype (temp/drag-reorder-demo.html):
 * pointer-carry with a hand-like lag, the old slot closing up, a drop line that
 * grows from its middle and glides between gaps, a ripple push on the neighbours
 * (amplitude × 0.7ⁿ starting 24ms × n later) and FLIP springs on commit/cancel.
 * All motion is transform-only; under prefers-reduced-motion only the drop line
 * remains. Item heights may differ — positions are measured per drag, not derived.
 *
 * Lists sharing a `group` key are connected: a drag can carry an item from one
 * list into another (kanban columns); each list keeps its own drop line and the
 * source list keeps the vacated slot closed until drop. Cross-list commits call
 * onMoveOut on the source and onMoveIn(itemId, orderedIds) on the target; the
 * FLIP afterCommit runs on every involved list once React re-orders.
 *
 * React owns the DOM order; on commit the engine captures rects, calls the
 * commit callbacks, and the component calls afterCommit() from a layout effect
 * once React has re-ordered, which is where the FLIP springs are armed.
 */
import { motionTokens } from "@/lib/motion-tokens";

const SETTLE = { k: motionTokens.spring.dragSettle.stiffness, c: motionTokens.spring.dragSettle.damping };
const FOLLOW = { k: motionTokens.spring.dragFollow.stiffness, c: motionTokens.spring.dragFollow.damping };
const LINE = { k: 500, c: 40 };
const RIPPLE_STEP = 24;
const RIPPLE_DECAY = 0.7;
const OUTSIDE_MARGIN = 32;
const DRAG_THRESHOLD = 4; // px of movement before a press becomes a drag
const FLIP_DEADLINE_MS = 150;

export type SortableAnnounce =
  | { type: "picked"; title: string; total: number }
  | { type: "moved"; title: string; pos: number }
  | { type: "dropped"; title: string; pos: number }
  | { type: "cancelled" };

export interface SortableEngineOptions {
  vertical: boolean;
  amplitude: number;
  /** Shared key connects lists for cross-list drags (e.g. kanban columns). */
  group?: string;
  onCommit: (orderedIds: string[]) => void;
  onMoveOut?: (itemId: string) => void;
  onMoveIn?: (itemId: string, orderedIds: string[]) => void;
  labelOf: (id: string) => string;
  announce: (e: SortableAnnounce) => void;
}

type Spring = { v: number; t: number; vel: number; pend: { t: number; at: number } | null; k: number; c: number };
type Pair = { sx: Spring; sy: Spring };
interface Rect { top: number; left: number; w: number; h: number }

/** One list taking part in the current drag (the source, plus group members). */
interface Member {
  engine: SortableEngine;
  el: HTMLElement; // the list element
  ids: string[];
  els: HTMLElement[];
  rects: Rect[]; // relative to el
  closeIdx: number; // dragged item's index in THIS list (-1 elsewhere)
  closeDelta: number;
}

interface DragState {
  carryId: string;
  carryEl: HTMLElement;
  members: Member[]; // [source, ...group members]
  source: Member;
  target: Member;
  k: number;
  outside: boolean;
  wasOutside: boolean;
  retargeted: boolean; // target changed since last frame
  keyboard: boolean;
  pointer: { x: number; y: number };
  startP: { x: number; y: number };
  fx: Spring;
  fy: Spring;
}

const groups = new Map<string, Set<SortableEngine>>();

const mkSpring = (cfg: { k: number; c: number }, v = 0): Spring => ({ v, t: v, vel: 0, pend: null, k: cfg.k, c: cfg.c });

function stepSpring(s: Spring, dt: number, now: number, reduced: boolean) {
  if (s.pend && now >= s.pend.at) { s.t = s.pend.t; s.pend = null; }
  if (reduced) { s.v = s.t; s.vel = 0; return; }
  const a = -s.k * (s.v - s.t) - s.c * s.vel;
  s.vel += a * dt;
  s.v += s.vel * dt;
}
const resting = (s: Spring) => !s.pend && Math.abs(s.v - s.t) < 0.05 && Math.abs(s.vel) < 2;

export class SortableEngine {
  private list: HTMLElement;
  private opts: SortableEngineOptions;
  private disabled = false;
  private drag: DragState | null = null;
  private pairs = new Map<string, Pair>();
  private line: HTMLElement | null = null;
  private lineShown = false;
  private lineS = mkSpring(LINE);
  private raf = 0;
  private lastT = 0;
  // FLIP across a React commit; flipBefore may be shared across group members.
  private flipArmed = false;
  private flipDeadline = 0;
  private flipBefore = new Map<string, DOMRect>();
  private flipCarry: string | null = null;
  private flipFollow: { dx: number; dy: number } | null = null;
  private flipKeyboard = false;
  private rm = matchMedia("(prefers-reduced-motion: reduce)");
  // A press that hasn't travelled DRAG_THRESHOLD yet (clicks still work).
  private pending: { li: HTMLElement; x: number; y: number } | null = null;
  // Ancestor styles neutralised while dragging so the carried card is never
  // clipped (overflow) or painted under sibling columns (stacking).
  private clipRestore: { el: HTMLElement; overflow: string; zIndex: string; position: string }[] = [];

  constructor(list: HTMLElement, opts: SortableEngineOptions) {
    this.list = list;
    this.opts = opts;
    this.line = list.querySelector(":scope > [data-sortable-line]");
    if (opts.group) {
      let set = groups.get(opts.group);
      if (!set) groups.set(opts.group, (set = new Set()));
      set.add(this);
    }
    list.addEventListener("pointerdown", this.onPointerDown);
    list.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keydown", this.onDocKey, true);
  }

  destroy() {
    if (this.opts.group) groups.get(this.opts.group)?.delete(this);
    this.list.removeEventListener("pointerdown", this.onPointerDown);
    this.list.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keydown", this.onDocKey, true);
    this.detachWindow();
    this.cancelLoop();
    this.flush();
    document.documentElement.classList.remove("dz-dragging");
  }

  setDisabled(disabled: boolean) {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    if (disabled && this.drag) this.drop(true);
  }

  private items(): HTMLElement[] {
    return Array.from(this.list.children).filter(
      (el) => (el as HTMLElement).dataset && (el as HTMLElement).dataset.sortableId
    ) as HTMLElement[];
  }

  private get reduced() { return this.rm.matches; }

  /* ---------------- drag lifecycle ---------------- */

  private onPointerDown = (e: PointerEvent) => {
    if (this.disabled || this.drag) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    const li = target.closest?.("[data-sortable-id]") as HTMLElement | null;
    if (!li || li.parentElement !== this.list || li.dataset.sortableDisabled === "true") return;
    // Drag starts from a handle, or from anywhere on the item as long as the
    // press isn't on an interactive control (buttons/links keep their clicks).
    const handle = target.closest?.("[data-sortable-handle]");
    const interactive = target.closest?.("button, a, input, textarea, select, label, form, [data-no-drag]");
    if (!handle && interactive) return;
    e.preventDefault();
    this.pending = { li, x: e.clientX, y: e.clientY };
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
  };
  private detachWindow() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
  }
  private onPointerMove = (e: PointerEvent) => {
    if (this.pending) {
      if (Math.hypot(e.clientX - this.pending.x, e.clientY - this.pending.y) < DRAG_THRESHOLD) return;
      const li = this.pending.li;
      this.pending = null;
      this.start(li, { x: e.clientX, y: e.clientY }, false);
    }
    const d = this.drag;
    if (!d || d.keyboard) return;
    d.pointer = { x: e.clientX, y: e.clientY };
    d.fx.t = e.clientX;
    d.fy.t = e.clientY;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (this.pending) {
      this.pending = null;
      this.detachWindow();
      return; // never became a drag — the click goes through
    }
    if (!this.drag || this.drag.keyboard) return;
    // The release can arrive before the next animation frame. Resolve the
    // final pointer position directly rather than committing a stale hint.
    const d = this.drag;
    d.pointer = { x: e.clientX, y: e.clientY };
    const target = this.memberAt(d.pointer);
    d.outside = !target;
    if (target) {
      d.target = target;
      const rect = target.el.getBoundingClientRect();
      d.k = this.insertionIn(target, this.opts.vertical ? e.clientY - rect.top : e.clientX - rect.left);
    }
    this.drop(false);
  };
  private onPointerCancel = () => {
    this.pending = null;
    if (!this.drag || this.drag.keyboard) return;
    this.drop(true);
  };
  private onDocKey = (e: KeyboardEvent) => {
    if (this.drag && !this.drag.keyboard && e.key === "Escape") {
      e.preventDefault();
      this.drop(true);
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const li = target.closest?.("[data-sortable-id]") as HTMLElement | null;
    if (!li || li.parentElement !== this.list) return;
    if (!this.drag) {
      if (this.disabled || li.dataset.sortableDisabled === "true") return;
      // Pickup only when the list item itself is focused — focusable children
      // (e.g. card bodies with role=button) keep their own Enter behaviour.
      if (e.target !== li) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.start(li, null, true);
      }
      return;
    }
    const along = this.opts.vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    if (along.includes(e.key)) {
      e.preventDefault();
      this.setK(this.drag.k + (e.key === along[0] ? -1 : 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      this.setK(0);
    } else if (e.key === "End") {
      e.preventDefault();
      this.setK(this.drag.target.ids.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.drop(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.drop(true);
    }
  };

  private snapshot(): Member {
    const els = this.items();
    const ur = this.list.getBoundingClientRect();
    const rects: Rect[] = els.map((e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top - ur.top, left: r.left - ur.left, w: r.width, h: r.height };
    });
    this.pairs = new Map(els.map((e) => [e.dataset.sortableId!, { sx: mkSpring(SETTLE), sy: mkSpring(SETTLE) }]));
    return { engine: this, el: this.list, els, ids: els.map((e) => e.dataset.sortableId!), rects, closeIdx: -1, closeDelta: 0 };
  }

  /* Neutralise clipping/stacking on the ancestor chain while dragging so the
     carried card can travel the whole page: overflow is opened up and the
     chain is lifted above sibling columns. Everything is restored on drop. */
  private unclip() {
    let el: HTMLElement | null = this.list;
    while (el && el !== document.body && this.clipRestore.length < 16) {
      const cs = getComputedStyle(el);
      this.clipRestore.push({ el, overflow: el.style.overflow, zIndex: el.style.zIndex, position: el.style.position });
      if (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible") {
        el.style.overflow = "visible";
      }
      if (cs.position === "static") el.style.position = "relative";
      el.style.zIndex = "999";
      el = el.parentElement;
    }
  }
  private reclip() {
    for (let i = this.clipRestore.length - 1; i >= 0; i--) {
      const r = this.clipRestore[i];
      r.el.style.overflow = r.overflow;
      r.el.style.zIndex = r.zIndex;
      r.el.style.position = r.position;
    }
    this.clipRestore = [];
  }

  private start(el: HTMLElement, p: { x: number; y: number } | null, keyboard: boolean) {
    const members = [this];
    if (this.opts.group) {
      (groups.get(this.opts.group) ?? []).forEach((other) => {
        if (other !== this && other.list.isConnected) members.push(other);
      });
    }
    // Hard-stop any leftover settle on every involved list so measurement is clean.
    members.forEach((m) => m.flush());

    const source = this.snapshot();
    const idx = source.ids.indexOf(el.dataset.sortableId!);
    if (idx < 0) return;

    // Items below the dragged one shift up by its height + the gap beneath it.
    const next = source.rects[idx + 1];
    const gap = next ? next.top - (source.rects[idx].top + source.rects[idx].h) : 0;
    source.closeIdx = idx;
    source.closeDelta = source.rects[idx].h + gap;

    const groupMembers: Member[] = [source];
    if (this.opts.group) {
      members.forEach((m) => {
        if (m !== this) groupMembers.push(m.snapshot());
      });
    }

    this.drag = {
      carryId: source.ids[idx],
      carryEl: el,
      members: groupMembers,
      source,
      target: source,
      k: idx,
      outside: false,
      wasOutside: false,
      retargeted: true,
      keyboard,
      pointer: p ? { ...p } : { x: 0, y: 0 },
      startP: p ? { ...p } : { x: 0, y: 0 },
      fx: mkSpring(FOLLOW, p ? p.x : 0),
      fy: mkSpring(FOLLOW, p ? p.y : 0),
    };

    // Horizontal lists: raise the carried item clear above the row.
    if (!this.opts.vertical) {
      const r = source.rects[idx];
      el.style.setProperty("--dz-lift-y", `${-(r.top + r.h + 8)}px`);
    }
    el.setAttribute("data-dz-carry", "");
    el.style.pointerEvents = "none"; // no hover styles / no child clicks while carried
    if (keyboard) el.focus({ preventScroll: true }); // pointer drags never take focus — no focus ring
    document.documentElement.classList.add("dz-dragging");
    this.unclip();
    this.rippleTo(source, idx, true); // close the old slot only — no ripple at pick-up
    groupMembers.forEach((m) => m.engine.loop());
    this.opts.announce({ type: "picked", title: this.opts.labelOf(this.drag!.carryId), total: source.ids.length });
  }

  private setK(k: number) {
    const d = this.drag;
    if (!d) return;
    const clamped = Math.max(0, Math.min(k, d.target.ids.length - (d.target === d.source ? 1 : 0)));
    if (clamped === d.k) return;
    d.k = clamped;
    this.rippleTo(d.target, d.k, false);
    this.lineTo(d.target, d.k);
    this.opts.announce({ type: "moved", title: this.opts.labelOf(d.carryId), pos: d.k + 1 });
  }

  /* ---------------- geometry ---------------- */

  private axisOf(r: Rect) { return this.opts.vertical ? r.top + r.h / 2 : r.left + r.w / 2; }
  private startOf(r: Rect) { return this.opts.vertical ? r.top : r.left; }
  private sizeOf(r: Rect) { return this.opts.vertical ? r.h : r.w; }

  private insertionIn(m: Member, p: number): number {
    let k = 0;
    m.rects.forEach((r, i) => {
      if (i === m.closeIdx) return;
      const shift = i > m.closeIdx ? -m.closeDelta : 0;
      if (p > this.axisOf(r) + shift) k++;
    });
    const max = m.ids.length - (m === this.drag?.source ? 1 : 0);
    return Math.max(0, Math.min(k, max));
  }

  private gapCenterIn(m: Member, k: number): number {
    const vis: { start: number; size: number }[] = [];
    m.rects.forEach((r, i) => {
      if (i === m.closeIdx) return;
      vis.push({
        start: this.startOf(r) + (i > m.closeIdx ? -m.closeDelta : 0),
        size: this.sizeOf(r),
      });
    });
    if (vis.length === 0) return 0;
    const gap = vis.length > 1 ? vis[1].start - (vis[0].start + vis[0].size) : 8;
    if (k <= 0) return vis[0].start - gap / 2;
    if (k >= vis.length) return vis[vis.length - 1].start + vis[vis.length - 1].size + gap / 2;
    return (vis[k - 1].start + vis[k - 1].size + vis[k].start) / 2;
  }

  /** A single list extends indefinitely along its sorting axis, so overshooting
   *  either end still inserts first/last. Leaving the cross axis cancels.
   *  A group behaves as one board: the x axis picks the
   *  column (any y works — the list rect only wraps the cards, so vertical
   *  distance must not disqualify), and only leaving the board horizontally
   *  cancels the drop. */
  private memberAt(p: { x: number; y: number }): Member | null {
    const d = this.drag!;
    const rects = d.members.map((m) => m.el.getBoundingClientRect());
    const m = OUTSIDE_MARGIN;
    if (d.members.length === 1) {
      const r = rects[0];
      const inside = this.opts.vertical
        ? p.x >= r.left - m && p.x <= r.right + m
        : p.y >= r.top - m && p.y <= r.bottom + m;
      return inside ? d.members[0] : null;
    }
    const u = rects.reduce(
      (a, r) => ({ l: Math.min(a.l, r.left), r: Math.max(a.r, r.right) }),
      { l: Infinity, r: -Infinity }
    );
    if (p.x < u.l - m || p.x > u.r + m) return null;
    let best: Member | null = null;
    let bestScore = Infinity;
    d.members.forEach((mem, i) => {
      const r = rects[i];
      const inside = p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
      const dx = p.x < r.left ? r.left - p.x : p.x > r.right ? p.x - r.right : 0;
      const dy = p.y < r.top ? r.top - p.y : p.y > r.bottom ? p.y - r.bottom : 0;
      const score = inside ? -1 : dx * 1e4 + dy; // x picks the column, y breaks ties
      if (score < bestScore) { bestScore = score; best = mem; }
    });
    return best;
  }

  /* ---------------- ripple + line ---------------- */

  /** Ripple targets for one member; k=null turns the ripple off (base only). */
  private rippleTo(m: Member, k: number | null, immediate: boolean) {
    const now = performance.now();
    let j = 0;
    m.ids.forEach((id, i) => {
      if (i === m.closeIdx) return;
      const pair = m.engine.pairs.get(id);
      if (!pair) return;
      const base = i > m.closeIdx ? -m.closeDelta : 0;
      const n = k == null ? 0 : j < k ? k - 1 - j : j - k;
      const ripOn = k != null && !immediate && !this.reduced;
      const rip = ripOn ? (j < k ? -1 : 1) * this.opts.amplitude * Math.pow(RIPPLE_DECAY, n) : 0;
      const target = base + rip;
      const s = this.opts.vertical ? pair.sy : pair.sx;
      const delay = immediate || this.reduced ? 0 : RIPPLE_STEP * n;
      if (delay <= 0) { s.t = target; s.pend = null; }
      else s.pend = { t: target, at: now + delay };
      j++;
    });
    m.engine.loop();
  }

  /** Show/glide/hide the drop line inside a member (null hides). */
  private lineTo(m: Member, k: number | null) {
    const engine = m.engine;
    if (!engine.line) return;
    const show = k != null;
    if (show) {
      const target = this.gapCenterIn(m, k);
      if (!engine.lineShown) {
        engine.lineS.v = engine.lineS.t = target;
        engine.lineS.vel = 0;
        engine.lineS.pend = null;
        engine.line.setAttribute("data-dz-show", "");
        engine.line.removeAttribute("data-dz-grow");
        void (engine.line.firstElementChild as HTMLElement).offsetWidth;
        engine.line.setAttribute("data-dz-grow", "");
        engine.lineShown = true;
      } else {
        engine.lineS.t = target;
        engine.lineS.pend = null;
      }
    } else if (engine.lineShown) {
      engine.line.removeAttribute("data-dz-show");
      engine.lineShown = false;
    }
  }

  /* ---------------- drop / cancel ---------------- */

  private drop(forceCancel: boolean) {
    const d = this.drag;
    if (!d) return;
    this.detachWindow();
    this.drag = null;
    const goHome = forceCancel || (!d.keyboard && d.outside);
    const cross = d.target !== d.source;
    const commit = !goHome && (cross ? true : d.k !== d.source.closeIdx);

    document.documentElement.classList.remove("dz-dragging");
    this.reclip();

    if (commit) {
      const carry = d.carryId;
      const order = d.target.ids.filter((id) => id !== carry);
      order.splice(Math.min(d.k, order.length), 0, carry);

      // Capture visual rects across every involved list for the FLIP.
      const before = new Map<string, DOMRect>();
      d.members.forEach((m) => m.els.forEach((el, i) => before.set(m.ids[i], el.getBoundingClientRect())));
      const follow = d.keyboard ? null : { dx: d.fx.v - d.startP.x, dy: d.fy.v - d.startP.y };
      [d.source, d.target].forEach((m) => {
        m.engine.flipBefore = before;
        m.engine.flipCarry = carry;
        m.engine.flipFollow = follow;
        m.engine.flipKeyboard = d.keyboard;
        m.engine.flipArmed = true;
        m.engine.flipDeadline = performance.now() + FLIP_DEADLINE_MS;
      });

      this.opts.announce({ type: "dropped", title: this.opts.labelOf(carry), pos: d.k + 1 });
      if (cross) {
        d.source.engine.opts.onMoveOut?.(carry);
        d.target.engine.opts.onMoveIn?.(carry, order);
      } else {
        d.source.engine.opts.onCommit(order);
      }
    } else {
      d.members.forEach((m) => m.engine.resetOffsets());
      const pair = d.source.engine.pairs.get(d.carryId);
      if (!d.keyboard && pair) {
        pair.sx.v = d.fx.v - d.startP.x;
        pair.sy.v = d.fy.v - d.startP.y;
      }
      this.opts.announce({ type: "cancelled" });
      this.settleCarry(d.carryEl);
      d.members.forEach((m) => m.engine.loop());
    }
    d.members.forEach((m) => this.lineTo(m, null));
    this.loop();
  }

  private resetOffsets() {
    this.pairs.forEach((p) => {
      p.sx.t = 0; p.sy.t = 0; p.sx.pend = null; p.sy.pend = null;
    });
  }

  /** Called from the component's layout effect after React re-ordered the DOM
   *  (and as a deadline fallback when the parent ignores the commit). */
  afterCommit() {
    if (!this.flipArmed) return;
    this.flipArmed = false;
    const before = this.flipBefore;
    const carryId = this.flipCarry;
    const follow = this.flipFollow;
    const keyboard = this.flipKeyboard;
    this.flipCarry = null;
    this.flipFollow = null;
    const els = this.items();
    els.forEach((el) => {
      const id = el.dataset.sortableId!;
      const b = before.get(id);
      const pair = this.pairs.get(id);
      if (!b || !pair) return;
      const now = el.getBoundingClientRect();
      if (id === carryId && follow) {
        pair.sx.v = follow.dx + (b.left - now.left);
        pair.sy.v = follow.dy + (b.top - now.top);
      } else {
        pair.sx.v += b.left - now.left;
        pair.sy.v += b.top - now.top;
      }
      pair.sx.t = 0; pair.sx.pend = null;
      pair.sy.t = 0; pair.sy.pend = null;
      el.style.transform = `translate(${pair.sx.v}px, ${pair.sy.v}px)`;
    });
    const carryEl = els.find((el) => el.dataset.sortableId === carryId);
    if (carryEl) {
      this.settleCarry(carryEl);
      if (keyboard) carryEl.focus({ preventScroll: true });
    }
    this.loop();
  }

  private settleCarry(el: HTMLElement) {
    el.removeAttribute("data-dz-carry");
    el.style.pointerEvents = "";
    el.setAttribute("data-dz-settle", "");
    window.setTimeout(() => el.removeAttribute("data-dz-settle"), 400);
  }

  private flush() {
    this.pending = null;
    this.items().forEach((el) => {
      el.style.transform = "";
      el.style.pointerEvents = "";
      el.removeAttribute("data-dz-carry");
      el.removeAttribute("data-dz-settle");
    });
    this.reclip();
    this.pairs = new Map();
    if (this.line && this.lineShown) {
      this.line.removeAttribute("data-dz-show");
      this.lineShown = false;
    }
  }

  /* ---------------- animation loop ---------------- */

  private loop() {
    if (!this.raf) {
      this.lastT = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }
  private cancelLoop() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  private tick = (now: number) => {
    const dt = Math.min(0.033, Math.max(0.001, (now - this.lastT) / 1000));
    this.lastT = now;
    const d = this.drag;
    const reduced = this.reduced;

    if (d) {
      if (!d.keyboard) {
        stepSpring(d.fx, dt, now, reduced);
        stepSpring(d.fy, dt, now, reduced);
        d.carryEl.style.transform =
          `translate(${d.fx.v - d.startP.x}px, ${d.fy.v - d.startP.y}px)`;

        const m = this.memberAt(d.pointer);
        const out = m == null;
        d.outside = out;
        if (m && m !== d.target) {
          // Leaving a list: its line hides and its items settle home (the
          // source keeps the vacated slot closed).
          this.lineTo(d.target, null);
          this.rippleTo(d.target, null, false);
          d.target = m;
          d.retargeted = true;
          d.k = -1;
        }
        if (m) {
          const r = m.el.getBoundingClientRect();
          const p = this.opts.vertical ? d.pointer.y - r.top : d.pointer.x - r.left;
          const kNow = this.insertionIn(m, p);
          if (kNow !== d.k || d.retargeted || out !== d.wasOutside) {
            d.k = kNow;
            // Own slot in the source list: line hidden, ripple off — same as
            // the single-list behaviour.
            const hintOn = !out && !(m === d.source && d.k === d.source.closeIdx);
            this.rippleTo(m, hintOn ? d.k : null, false);
            this.lineTo(m, hintOn ? d.k : null);
          }
        } else if (d.retargeted || !d.wasOutside) {
          this.rippleTo(d.source, null, false);
        }
        d.retargeted = false;
        d.wasOutside = out;
      } else {
        this.lineTo(d.target, d.k === d.source.closeIdx && d.target === d.source ? null : d.k);
      }
    } else if (this.flipArmed && now > this.flipDeadline) {
      this.afterCommit(); // parent never re-ordered — treat as cancel
    }

    let moving = !!d;
    for (const el of this.items()) {
      const pair = this.pairs.get(el.dataset.sortableId!);
      if (!pair) continue;
      stepSpring(pair.sx, dt, now, reduced);
      stepSpring(pair.sy, dt, now, reduced);
      if (d && el === d.carryEl) continue; // carried item is follow-driven
      const x = pair.sx.v;
      const y = pair.sy.v;
      el.style.transform = Math.abs(x) > 0.01 || Math.abs(y) > 0.01 ? `translate(${x}px, ${y}px)` : "";
      if (!resting(pair.sx) || !resting(pair.sy)) moving = true;
    }

    if (this.line) {
      stepSpring(this.lineS, dt, now, reduced);
      this.line.style.transform = this.opts.vertical
        ? `translateY(${this.lineS.v}px)`
        : `translateX(${this.lineS.v}px)`;
    }

    if (!d && !moving) {
      this.raf = 0;
      this.items().forEach((el) => { el.style.transform = ""; });
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}
