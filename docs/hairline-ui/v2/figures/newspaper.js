const {
  Cam, clamp, facing, fit, hull, lerp, open, poly, prism, proj, put, rad,
  rrect, ringAt, seg, spring, stepS, disposer, mk, pointer, register, solid,
} = HL;

const REST = 17, HINGE = 0.35, PAPER = rrect(-51, -39, 51, 0, 3.5, 6);
const LEAF_IN = rrect(-48.5, -36.5, 48.5, -2.5, 1.5, 6);

function mount({ stage, svg, read }, value) {
  const bag = disposer(), C = Cam(45, 0.5, 1.95);
  fit(C, [[-59, -45, -3], [61, 45, -3], [61, -45, 32], [-59, 45, 32]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  const rear = solid(g), frontSheet = solid(g), spread = solid(g);
  put(rear, prism(P, front, rrect(-55, -42, 54, 40, 3, 5), rrect(-53, -40, 52, 38, 2, 5), -3, -2));
  put(frontSheet, prism(P, front, rrect(-52, -40, 58, 43, 3, 5), rrect(-50, -38, 56, 41, 2, 5), -2, -1.2));
  put(spread, prism(P, front, rrect(-50, -38, 50, 38, 4, 6), rrect(-48, -36, 48, 36, 2, 6), -1.2, 0.35));
  const printBase = mk("path", { class: "nf lo" }, g), fold = mk("path", { class: "nf lo" }, g);
  const leaf = solid(g), ink = mk("path", { class: "nf lo" }, g), photo = mk("path", { class: "nf" }, g);
  const photoDetail = mk("path", { class: "nf lo" }, g), foldMark = mk("path", { class: "hi" }, g);
  const angle = spring(REST, { eps: 0.025 });
  let maxOpen = value, active = false, fraction = 0, drawn = NaN;

  const pageAt = (x, y, a, z = HINGE) => P(x, y * Math.cos(rad(a)), z - y * Math.sin(rad(a)));
  const leafRing = PAPER.map((q) => ({ ...q }));
  const hitPoly = leafRing.map((q) => pageAt(q.u, q.v, REST));
  const contains = (pt, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [x, y] = pts[i], [a, b] = pts[j];
      if ((y > pt[1]) !== (b > pt[1]) && pt[0] < (a - x) * (pt[1] - y) / (b - y) + x) inside = !inside;
    }
    return inside;
  };
  const baseLines = [];
  for (const y of [-31, -26, -21, -16, 7, 12, 17, 22, 27, 32]) {
    for (const [x, w] of [[-43, 17], [-21, 16], [4, 17], [27, 16]]) baseLines.push(seg(P(x, y, 0.42), P(x + w, y, 0.42)));
  }
  printBase.setAttribute("d", baseLines.join(""));
  fold.setAttribute("d", seg(P(-49, 0, 0.48), P(49, 0, 0.48)));

  function draw(a) {
    if (a === drawn) return;
    drawn = a;
    const top = leafRing.map((q) => pageAt(q.u, q.v, a));
    put(leaf, { sil: poly(hull(ringAt(P, leafRing, HINGE).concat(top))), crease: open(LEAF_IN.map((q) => pageAt(q.u, q.v, a))) });
    leaf.sil.classList.toggle("hi", active);
    foldMark.setAttribute("d", seg(pageAt(-49, 0, a), pageAt(49, 0, a)));
    foldMark.classList.toggle("hi", !active);

    const lines = [];
    for (const y of [-8, -13, -18, -23, -28, -33]) {
      lines.push(seg(pageAt(-44, y, a), pageAt(-27 + (y === -28 ? 3 : 0), y, a)));
      lines.push(seg(pageAt(-21, y, a), pageAt(-4 + (y === -33 ? 4 : 0), y, a)));
    }
    ink.setAttribute("d", lines.join(""));
    const frame = rrect(7, -34, 43, -13, 2.5, 5);
    photo.setAttribute("d", poly(frame.map((q) => pageAt(q.u, q.v, a))));
    const sun = [];
    for (let i = 0; i <= 16; i++) {
      const t = i * Math.PI * 2 / 16;
      sun.push(pageAt(34 + Math.cos(t) * 3, -27 + Math.sin(t) * 3, a));
    }
    photoDetail.setAttribute("d", open([pageAt(10, -18, a), pageAt(19, -29, a), pageAt(25, -22, a), pageAt(32, -30, a), pageAt(40, -18, a)]) + open(sun));
  }
  draw(REST);

  const B = register(stage, (dt) => {
    const moving = stepS(angle, dt);
    draw(angle.x);
    return moving;
  });
  bag.add(B.unregister);
  const retarget = (p) => {
    if (p && contains(p, hitPoly)) {
      const h = P(0, 0, HINGE), e = pageAt(0, -39, REST), dx = e[0] - h[0], dy = e[1] - h[1];
      fraction = clamp(((p[0] - h[0]) * dx + (p[1] - h[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      active = true; angle.t = lerp(REST, maxOpen, fraction); read.textContent = "fold";
    } else { active = false; angle.t = REST; read.textContent = "rest"; }
    drawn = NaN; B.wake();
  };
  bag.add(pointer(stage, { move: (p) => retarget(p), leave: () => retarget(null) }));
  bag.add(() => svg.replaceChildren());
  return {
    set: (v) => { maxOpen = v; if (active) { angle.t = lerp(REST, maxOpen, fraction); B.wake(); } },
    destroy: bag.dispose,
  };
}

hairline({
  name: "newspaper",
  means: "A folded newspaper opens at its centre crease to reveal columns and a picture.",
  rules: [1, 3, 5, 6, 9, 10],
  range: [28, 40, 52],
  mount,
});
