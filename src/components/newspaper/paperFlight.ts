/** A folded newspaper that travels between its drawer slot and the reading desk.
 *
 * The sheet folds in half bottom-to-top twice, into a strip as wide as the paper:
 * the shape that stands in a file drawer. Each fold is a static half plus a hinged
 * half with a front (print) and back (paper) face. */

export interface PaperRect { left: number; top: number; width: number; height: number }

const EASE_OUT = "cubic-bezier(.16, 1, .3, 1)";
const EASE_IN_OUT = "cubic-bezier(.65, 0, .35, 1)";
const EASE_FOLD = "cubic-bezier(.45, .05, .25, 1)";

export function paperMotionAllowed() {
  return typeof window !== "undefined"
    && typeof Element !== "undefined"
    && typeof Element.prototype.animate === "function"
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function rectOf(element: Element | null | undefined): PaperRect | null {
  if (!element) return null;
  const r = element.getBoundingClientRect();
  return r.width && r.height ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

/** The part of the reading sheet that is on screen: that is what folds. */
export function visiblePaperRect(paper: Element | null): PaperRect | null {
  const r = rectOf(paper);
  if (!r) return null;
  const top = Math.max(r.top, 0);
  const bottom = Math.min(r.top + r.height, window.innerHeight);
  return { left: r.left, top, width: r.width, height: Math.max(120, bottom - top) };
}

function el(tag: string, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** A print of the sheet as it lies open: a copy of the real paper, cut to the part on screen. */
function printOf(paper: HTMLElement, open: PaperRect) {
  const r = paper.getBoundingClientRect();
  const print = el("div", "np-print");
  print.style.width = `${open.width}px`;
  print.style.height = `${open.height}px`;
  const copy = paper.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  Object.assign(copy.style, { position: "absolute", left: "0px", top: `${r.top - open.top}px`, width: `${r.width}px`, margin: "0", visibility: "visible" });
  print.append(copy);
  return print;
}

/** A clipped window into the print, offset so the halves line up across the crease. */
function windowInto(print: HTMLElement, x: number, y: number, w: number, h: number) {
  const win = el("div", "np-fold-window");
  win.style.width = `${w}px`;
  win.style.height = `${h}px`;
  const copy = print.cloneNode(true) as HTMLElement;
  copy.style.transform = `translate(${-x}px, ${-y}px)`;
  win.append(copy);
  return win;
}

function place(node: HTMLElement, rect: PaperRect) {
  Object.assign(node.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
}

/** One fold across the middle: the top half stays, the bottom half hinges on the crease. */
function foldStage(rect: PaperRect, print: HTMLElement) {
  const stage = el("div", "np-fold-stage");
  place(stage, rect);
  const w = rect.width, h = rect.height / 2;

  const still = el("div", "np-fold-half np-fold-still");
  Object.assign(still.style, { left: "0px", top: "0px", width: `${w}px`, height: `${h}px` });
  still.append(windowInto(print, 0, 0, w, h), el("div", "np-fold-cast"));

  const hinge = el("div", "np-fold-half np-fold-hinge");
  Object.assign(hinge.style, { left: "0px", top: `${h}px`, width: `${w}px`, height: `${h}px`, transformOrigin: "50% 0" });
  const front = el("div", "np-fold-face np-fold-front");
  const shade = el("div", "np-fold-shade");
  front.append(windowInto(print, 0, h, w, h), shade);
  const back = el("div", "np-fold-face np-fold-back");
  back.style.transform = "rotateX(180deg)";
  hinge.append(front, back);

  stage.append(still, hinge);
  return { stage, hinge, shade, cast: still.lastElementChild as HTMLElement };
}

function layer() {
  const root = el("div", "np-flight np-scope");
  root.setAttribute("aria-hidden", "true");
  document.body.append(root);
  return root;
}

const finished = (animation: Animation) => animation.finished.then(() => undefined, () => undefined);

/* Folding backwards, under the top half, keeps the masthead outside as a real paper is folded. */
const SHUT = "rotateX(-180deg)";

async function runFold(root: HTMLElement, rect: PaperRect, print: HTMLElement, opening: boolean, duration: number) {
  const { stage, hinge, shade, cast } = foldStage(rect, print);
  root.replaceChildren(stage);
  const frames = opening ? [{ transform: SHUT }, { transform: "none" }] : [{ transform: "none" }, { transform: SHUT }];
  const shadeFrames = opening ? [{ opacity: .5 }, { opacity: .35, offset: .5 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: .35, offset: .5 }, { opacity: .5 }];
  const castFrames = opening ? [{ opacity: .9 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: .9 }];
  const options: KeyframeAnimationOptions = { duration, easing: EASE_FOLD, fill: "forwards" };
  shade.animate(shadeFrames, options);
  cast.animate(castFrames, options);
  await finished(hinge.animate(frames, options));
}

/** The folded strip, as a single sheet: the shape that travels. */
function strip(rect: PaperRect, print: HTMLElement) {
  const q = el("div", "np-fold-stage np-fold-quarter");
  place(q, { ...rect, height: rect.height / 4 });
  q.append(windowInto(print, 0, 0, rect.width, rect.height / 4));
  q.style.transformOrigin = "0 0";
  return q;
}

/** Where the strip must sit, as a transform from its resting box, to look like the slot in the drawer. */
function slotTransform(open: PaperRect, slot: PaperRect) {
  const scale = slot.width / open.width;
  return {
    transform: `translate(${slot.left - open.left}px, ${slot.top - open.top}px) scale(${scale})`,
    /* Only the slot's height shows above the file in front; the rest is down in the tray. */
    clip: `inset(0 0 calc(100% - ${slot.height / scale}px) 0)`,
    lift: `translate(${slot.left - open.left}px, ${slot.top - open.top - Math.min(120, (open.height / 4) * scale * .6)}px) scale(${scale})`,
  };
}

/** Draw the paper out of its slot and open it to `open`. Resolves when the sheet lies flat. */
export async function unfoldPaper({ from, paper, open, desk }: { from: PaperRect | null; paper: HTMLElement; open: PaperRect; desk?: HTMLElement | null }) {
  if (!paperMotionAllowed()) return;
  const root = layer();
  const print = printOf(paper, open);
  try {
    const q = strip(open, print);
    root.append(q);
    desk?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 520, easing: "ease-out", fill: "backwards" });
    if (from) {
      const slot = slotTransform(open, from);
      await finished(q.animate([
        { transform: slot.transform, clipPath: slot.clip, opacity: 0 },
        { opacity: 1, offset: .14 },
        { transform: slot.lift, clipPath: "inset(0 0 0 0)", offset: .34, easing: EASE_IN_OUT },
        { transform: "none", clipPath: "inset(0 0 0 0)", opacity: 1 },
      ], { duration: 700, easing: EASE_OUT, fill: "forwards" }));
    } else {
      await finished(q.animate([
        { transform: "translateY(24px) scale(.96)", opacity: 0 },
        { transform: "none", opacity: 1 },
      ], { duration: 360, easing: EASE_OUT, fill: "forwards" }));
    }
    await runFold(root, { ...open, height: open.height / 2 }, print, true, 380);
    await runFold(root, open, print, true, 460);
  } finally {
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" }).finished
      .catch(() => undefined).finally(() => root.remove());
  }
}

/** Fold the open sheet back into a strip, call `onFolded` (the desk can go), then file it into `to`. */
export async function foldPaper({ paper, open, to, onFolded, onLanding }: { paper: HTMLElement; open: PaperRect; to: () => PaperRect | null; onFolded: () => void; onLanding?: () => void }) {
  if (!paperMotionAllowed()) { onFolded(); return; }
  const root = layer();
  const print = printOf(paper, open);
  try {
    await runFold(root, open, print, false, 400);
    await runFold(root, { ...open, height: open.height / 2 }, print, false, 340);
    const q = strip(open, print);
    root.replaceChildren(q);
    onFolded();
    await new Promise(requestAnimationFrame);
    const slot = to();
    if (slot) {
      const target = slotTransform(open, slot);
      const duration = 760;
      const landing = window.setTimeout(() => onLanding?.(), duration * .8);
      await finished(q.animate([
        { transform: "none", clipPath: "inset(0 0 0 0)", opacity: 1 },
        { transform: target.lift, clipPath: "inset(0 0 0 0)", offset: .62, easing: EASE_IN_OUT },
        { opacity: 1, offset: .8 },
        { transform: target.transform, clipPath: target.clip, opacity: 0 },
      ], { duration, easing: EASE_OUT, fill: "forwards" }));
      window.clearTimeout(landing);
      onLanding?.();
    } else {
      await finished(q.animate([
        { transform: "none", opacity: 1 },
        { transform: "translateY(28px) scale(.92)", opacity: 0 },
      ], { duration: 320, easing: "ease-in", fill: "forwards" }));
    }
  } finally {
    root.remove();
  }
}
