/** An upright tent calendar. Its gridded page turns at the binding; stand and loops stay put. */
const {
  Cam, clamp, facing, fillet, fit, open, poly, proj, rad, rings, prism,
  spring, stepS, disposer, mk, register, pointer,
} = HL;

const X0 = -66, X1 = 66, Z0 = 22, Z1 = 117, Y = 4, REST = -7;
const COLS = 5, ROWS = 4, CW = 18, CH = 13, CX0 = -53, CZ0 = 91;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value, active = -1, lastAngle = NaN;
  const C = Cam(45, 0.5, 1.7);
  fit(C, [[-70, -31, 0], [70, 38, 7], [-70, -31, 120], [70, 38, 120], [-70, -31, 138], [70, 38, 138]], 200, 164);
  const P = proj(C), front = facing(C);
  const foot = rings(-48, -28, 48, 28, 8, 1.5);
  const base = prism(P, front, foot[0], foot[1], 0, 6);
  const baseG = mk("g", {}, svg);
  mk("path", { d: base.sil, class: "sil" }, baseG);
  mk("path", { d: base.crease, class: "lo nf" }, baseG);
  const rods = mk("path", { class: "lo nf" }, svg);
  const back = mk("path", { class: "lo" }, svg), backCrease = mk("path", { class: "lo nf" }, svg);
  const page = mk("path", { class: "sil" }, svg), crease = mk("path", { class: "lo nf" }, svg);
  const edge = mk("path", { class: "lo nf" }, svg);
  const cells = [], marks = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    cells.push(mk("path", { class: "lo nf" }, svg));
    marks.push(mk("circle", { r: 1.8, class: "dot off" }, svg));
  }
  const rule = mk("path", { class: "lo nf" }, svg);
  const loops = [mk("path", { class: "lo nf" }, svg), mk("path", { class: "lo nf" }, svg)];
  const tilt = spring(REST);

  const pagePoint = (x, z, angle = REST, y = Y) => {
    const dz = z - Z1, a = rad(angle);
    return P(x, y + dz * Math.sin(a), Z1 + dz * Math.cos(a));
  };
  const roundedFace = (x0, z0, x1, z1, r, angle, y = Y) =>
    fillet([[x0,z0],[x1,z0],[x1,z1],[x0,z1]], [r,r,r,r]).map(([x,z]) => pagePoint(x,z,angle,y));
  back.setAttribute("d", poly(roundedFace(X0, Z0, X1, Z1, 5, REST, Y + 2.5)));
  backCrease.setAttribute("d", open(roundedFace(X0 + 2.5, Z0 + 2.5, X1 - 2.5, Z1 - 2.5, 3, REST, Y + 2.5)));
  function draw(angle) {
    if (Math.abs(angle - lastAngle) < 0.01) return;
    lastAngle = angle;
    const outline = roundedFace(X0, Z0, X1, Z1, 5, angle);
    page.setAttribute("d", poly(outline));
    crease.setAttribute("d", open(roundedFace(X0 + 2.5, Z0 + 2.5, X1 - 2.5, Z1 - 2.5, 3, angle)));
    edge.setAttribute("d", open([pagePoint(X0, Z0, angle, Y - 2), pagePoint(X1, Z0, angle, Y - 2), pagePoint(X1, Z0, angle, Y)]));
    let k = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = CX0 + c * 22, z = CZ0 - r * 20;
      cells[k].setAttribute("d", poly(roundedFace(x, z - CH / 2, x + CW, z + CH / 2, 2, angle)));
      const dot = pagePoint(x + 3.4, z + 2.1, angle);
      marks[k].setAttribute("cx", dot[0]); marks[k].setAttribute("cy", dot[1]);
      k++;
    }
    rule.setAttribute("d", open([pagePoint(-56, 101, angle), pagePoint(56, 101, angle)]));
  }
  // Fixed tent struts behind the page.
  rods.setAttribute("d", [
    [-39, -25, 5, -39, -20, 88], [39, -25, 5, 39, -20, 88], [-39, -25, 5, 39, -25, 5],
    [-39, -20, 78, 39, -20, 78],
  ].map((v) => open([P(v[0], v[1], v[2]), P(v[3], v[4], v[5])])).join(""));
  loops.forEach((el, i) => {
    const cx = i ? 28 : -28, pts = [];
    for (let n = 0; n <= 16; n++) {
      const a = n / 16 * Math.PI * 2;
      pts.push(P(cx + Math.cos(a) * 4.8, Y + 1, 121 + Math.sin(a) * 6.1));
    }
    el.setAttribute("d", open(pts));
  });
  draw(REST);

  const centers = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = pagePoint(CX0 + c * 22 + CW / 2, CZ0 - r * 20, REST);
    centers.push(p);
  }
  const home = 6;
  function highlight(i) {
    cells.forEach((el, k) => el.classList.toggle("hi", k === (i < 0 ? home : i)));
    marks.forEach((el, k) => el.setAttribute("class", "dot " + (k === (i < 0 ? home : i) ? "m" : "off")));
  }
  highlight(-1);
  function choose(p) {
    let best = -1, d = Infinity;
    centers.forEach((q, i) => { const n = Math.hypot(p[0] - q[0], p[1] - q[1]); if (n < d) { best = i; d = n; } });
    return d < 18 ? best : -1;
  }
  function setActive(i) {
    if (i === active) return;
    active = i;
    const r = i < 0 ? -1 : Math.floor(i / COLS), c = i < 0 ? 2 : i % COLS;
    setTiltTarget(i, r, c);
    read.textContent = i < 0 ? "rest" : `cell ${r + 1}·${c + 1}`;
    highlight(i);
    loop.wake();
  }
  function setTiltTarget(i, r = -1, c = 2) {
    const sweep = (((c - 2) / 2) + ((1.5 - r) / 3) * 0.28) * reach * 0.75;
    tilt.t = i < 0 ? REST : REST + clamp(sweep, -12, 12);
  }
  const loop = register(stage, (dt) => { const moving = stepS(tilt, dt); draw(tilt.x); return moving; });
  bag.add(loop.unregister);
  bag.add(pointer(stage, { move: (p) => setActive(choose(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { reach = v; if (active >= 0) setTiltTarget(active, Math.floor(active / COLS), active % COLS); }, destroy: bag.dispose };
}

hairline({
  name: "calendar",
  means: "An upright desk calendar turns its gridded page around the binding beneath the pointer.",
  rules: [1, 3, 4, 5, 9],
  range: [7, 12, 18],
  mount,
});
