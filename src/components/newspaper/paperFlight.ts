/** A persistent paper scene shared by the archive slot and the reading desk.
 * Travel and folds overlap on one timeline; returning during entry reverses it. */
export interface PaperRect { left: number; top: number; width: number; height: number }

const EASE = "cubic-bezier(.22, .72, .18, 1)";
const SHUT = "rotateX(-180deg)";
type Flight = { animations: Animation[]; root: HTMLElement; done: Promise<void>; opening: boolean };
const flights = new WeakMap<HTMLElement, Flight>();

export function paperMotionAllowed() {
  return typeof window !== "undefined" && typeof Element !== "undefined"
    && typeof Element.prototype.animate === "function"
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function rectOf(element: Element | null | undefined): PaperRect | null {
  if (!element) return null;
  const r = element.getBoundingClientRect();
  return r.width && r.height ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

export function visiblePaperRect(paper: Element | null): PaperRect | null {
  const r = rectOf(paper);
  if (!r) return null;
  const top = Math.max(r.top, 0), bottom = Math.min(r.top + r.height, window.innerHeight);
  return bottom > top ? { left: r.left, top, width: r.width, height: bottom - top } : null;
}

function el(className: string) {
  const node = document.createElement("div");
  node.className = className;
  return node;
}

function cleanCopy(element: HTMLElement) {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  return copy;
}

/** Snapshot the visible print, including the current reading position. */
function printOf(paper: HTMLElement, open: PaperRect) {
  const r = paper.getBoundingClientRect();
  const print = el("np-print");
  Object.assign(print.style, { width: `${open.width}px`, height: `${open.height}px` });
  const copy = cleanCopy(paper);
  Object.assign(copy.style, {
    position: "absolute", left: "0px", top: `${r.top - open.top}px`,
    width: `${r.width}px`, margin: "0", visibility: "visible",
  });
  print.append(copy);
  return print;
}

function windowInto(print: HTMLElement, y: number, width: number, height: number) {
  const win = el("np-fold-window");
  Object.assign(win.style, { width: `${width}px`, height: `${height}px` });
  const copy = print.cloneNode(true) as HTMLElement;
  copy.style.transform = `translateY(${-y}px)`;
  win.append(copy);
  return win;
}

function place(node: HTMLElement, rect: PaperRect) {
  Object.assign(node.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
}

/** Both printed halves stay mounted from pickup to handoff. */
function scene(paper: HTMLElement, open: PaperRect, origin: PaperRect | null, cover?: HTMLElement | null) {
  const root = el("np-flight np-scope");
  root.setAttribute("aria-hidden", "true");
  root.inert = true;
  // The portal must inherit the user's theme even when it is set on the app root.
  if (paper.closest(".dark")) root.classList.add("dark");
  const stage = el("np-fold-stage");
  place(stage, open);
  stage.style.transformOrigin = "0 0";
  const print = printOf(paper, open), half = open.height / 2;
  const still = el("np-fold-half np-fold-still");
  place(still, { left: 0, top: 0, width: open.width, height: half });
  still.style.transform = "translateZ(.1px)";
  still.style.zIndex = "2";
  still.append(windowInto(print, 0, open.width, half));
  stage.append(still);
  const hinges: HTMLElement[] = [], shades: HTMLElement[] = [];
  for (const [top, height] of [[half, half]]) {
    const hinge = el("np-fold-half np-fold-hinge");
    place(hinge, { left: 0, top, width: open.width, height });
    hinge.style.transformOrigin = "50% 0";
    const front = el("np-fold-face np-fold-front"), back = el("np-fold-face np-fold-back"), shade = el("np-fold-shade");
    front.append(windowInto(print, top, open.width, height), shade);
    back.style.transform = "rotateX(180deg)";
    hinge.append(front, back);
    stage.append(hinge);
    hinges.push(hinge); shades.push(shade);
  }
  let jacket: HTMLElement | null = null;
  if (cover && origin) {
    jacket = el("np-fold-cover");
    place(jacket, { left: 0, top: 0, width: open.width, height: Math.min(half, origin.height * open.width / origin.width) });
    const copy = cleanCopy(cover);
    Object.assign(copy.style, {
      width: `${origin.width}px`, margin: "0", transformOrigin: "0 0",
      transform: `scale(${open.width / origin.width})`, visibility: "visible",
    });
    jacket.append(copy);
    stage.append(jacket);
  }
  root.append(stage);
  document.body.append(root);
  return { root, stage, hinges, shades, jacket };
}

function slotTransform(open: PaperRect, slot: PaperRect) {
  const scale = slot.width / open.width;
  const x = slot.left - open.left, y = slot.top - open.top;
  return {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    clip: `inset(0px 0px ${Math.max(0, open.height - slot.height / scale)}px 0px)`,
    lift: `translate(${x}px, ${y - 28}px) scale(${scale})`,
  };
}

function animatePaper({ paper, open, origin, cover, desk, opening }: {
  paper: HTMLElement; open: PaperRect; origin: PaperRect | null;
  cover?: HTMLElement | null; desk?: HTMLElement | null; opening: boolean;
}) {
  cancelPaperFlight(paper);
  const { root, stage, hinges, shades, jacket } = scene(paper, open, origin, cover);
  const animations: Animation[] = [];
  const startTime = document.timeline.currentTime;
  const duration = origin ? (opening ? 820 : 620) : (opening ? 280 : 200);
  const run = (element: HTMLElement, frames: Keyframe[]) => {
    const animation = element.animate(frames, { duration, fill: "both", direction: opening ? "normal" : "reverse" });
    if (startTime !== null) animation.startTime = startTime;
    animations.push(animation);
  };
  if (origin) {
    const slot = slotTransform(open, origin);
    run(stage, [
      { transform: slot.transform, clipPath: slot.clip, offset: 0, easing: EASE },
      { transform: slot.lift, clipPath: `inset(0px 0px ${open.height * .5}px 0px)`, offset: .19, easing: EASE },
      { transform: "translate(0px, 0px) scale(1)", clipPath: "inset(0px)", offset: 1 },
    ]);
    run(hinges[0], [{ transform: SHUT, offset: 0 }, { transform: SHUT, offset: .19, easing: EASE }, { transform: "rotateX(0deg)", offset: 1 }]);
    if (jacket) run(jacket, [{ transform: "translateZ(.3px) rotateX(0deg)", offset: 0 }, { transform: "translateZ(.3px) rotateX(0deg)", offset: .12, easing: EASE }, { transform: "translateZ(.3px) rotateX(-180deg)", offset: .5 }, { transform: "translateZ(.3px) rotateX(-180deg)", offset: 1 }]);
    shades.forEach((shade, i) => run(shade, [{ opacity: .18, offset: 0 }, { opacity: .18, offset: i ? .4 : .2 }, { opacity: 0, offset: 1 }]));
  } else {
    run(stage, [{ transform: "translateY(12px)", opacity: 0, easing: EASE }, { transform: "translateY(0px)", opacity: 1 }]);
  }
  if (desk) run(desk, [{ opacity: 0, offset: 0 }, { opacity: .9, offset: .55 }, { opacity: 1, offset: 1 }]);
  const flight: Flight = { root, animations, opening, done: Promise.resolve() };
  flights.set(paper, flight);
  flight.done = Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => {
    root.remove();
    animations.forEach((animation) => animation.cancel());
    if (flights.get(paper) === flight) flights.delete(paper);
  });
  return flight.done;
}

export function cancelPaperFlight(paper: HTMLElement) {
  const flight = flights.get(paper);
  if (!flight) return;
  flight.animations.forEach((animation) => animation.cancel());
  flight.root.remove();
  flights.delete(paper);
}

/** Escape during pickup runs the current frames backwards, without snapping open first. */
export async function reverseOpeningPaper(paper: HTMLElement) {
  const flight = flights.get(paper);
  if (!flight?.opening) return false;
  flight.opening = false;
  flight.animations.forEach((animation) => { animation.updatePlaybackRate(-1.3); animation.play(); });
  await flight.done;
  return true;
}

export async function unfoldPaper({ from, ...options }: {
  from: PaperRect | null; paper: HTMLElement; open: PaperRect; cover?: HTMLElement | null; desk?: HTMLElement | null;
}) {
  if (paperMotionAllowed()) await animatePaper({ ...options, origin: from, opening: true });
}

export async function foldPaper({ to, ...options }: {
  paper: HTMLElement; open: PaperRect; to: () => PaperRect | null; cover?: HTMLElement | null; desk?: HTMLElement | null;
}) {
  if (paperMotionAllowed()) await animatePaper({ ...options, origin: to(), opening: false });
}
