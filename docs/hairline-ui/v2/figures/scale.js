const {
  Cam, clamp, circ, fit, hull, open, poly, proj, put, rad, rings,
  seg, spring, stepS, disposer, mk, pointer, register, solid, unproj,
} = HL;

const PAD_X = 23, PAD_Y = 17, PAD_W = 15, PAD_H = 10;

function mount({ stage, svg, read }, value) {
  const bag = disposer(), C = Cam(45, 0.5, 2.1);
  fit(C, [[-58, -44, -2], [58, 44, -2], [58, -44, 10], [-58, 44, 10]], 200, 166);
  const P = proj(C), g = mk("g", {}, svg), lean = spring(0, { eps: 0.025 });
  const surface = (x) => 3 + Math.tan(rad(lean.x)) * x;
  const leaningPrism = (ring, inset, bottom, top) => ({
    sil: poly(hull(ring.map((q) => P(q.u, q.v, bottom(q.u))).concat(ring.map((q) => P(q.u, q.v, top(q.u)))))),
    crease: open(inset.map((q) => P(q.u, q.v, top(q.u)))),
  });
  const [base, baseIn] = rings(-55, -41, 55, 41, 9, 2.4), body = solid(g);
  const dial = circ(20, 24).map((q) => ({ u: q.u, v: q.v - 17 }));
  const dialIn = circ(18, 24).map((q) => ({ u: q.u, v: q.v - 17 }));
  const dialSolid = solid(g), ticks = mk("path", { class: "nf lo" }, g);
  const needle = mk("path", { class: "hi" }, g);
  const pads = [-1, 1].map((side) => {
    const [ring, inset] = rings(side * PAD_X - PAD_W, PAD_Y - PAD_H, side * PAD_X + PAD_W, PAD_Y + PAD_H, 5.5, 1.2);
    return { side, ring, inset, el: solid(g), depth: spring(3.2, { eps: 0.025 }) };
  });
  const needleSpring = spring(-90, { eps: 0.025 });
  let angleValue = value, active = 0, cursor = null, drawn = "";

  function draw() {
    const depths = pads.map((p) => p.depth.x), key = `${depths.join(",")},${lean.x},${needleSpring.x},${active}`;
    if (key === drawn) return;
    drawn = key;
    put(body, leaningPrism(base, baseIn, () => -2, surface));
    put(dialSolid, leaningPrism(dial, dialIn, surface, (x) => surface(x) + 0.8));
    const dialTicks = [];
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI * 2 / 16, r0 = i % 4 === 0 ? 13.5 : 15.2, r1 = 18;
      dialTicks.push(seg(P(Math.cos(a) * r0, -17 + Math.sin(a) * r0, surface(Math.cos(a) * r0) + 0.9), P(Math.cos(a) * r1, -17 + Math.sin(a) * r1, surface(Math.cos(a) * r1) + 0.9)));
    }
    ticks.setAttribute("d", dialTicks.join(""));
    const nx = Math.cos(rad(needleSpring.x)) * 14, ny = -17 + Math.sin(rad(needleSpring.x)) * 14;
    needle.setAttribute("d", seg(P(0, -17, surface(0) + 1.1), P(nx, ny, surface(nx) + 1.1)));
    needle.classList.toggle("hi", active === 0);
    pads.forEach((p, i) => {
      put(p.el, leaningPrism(p.ring, p.inset, surface, (x) => surface(x) + depths[i]));
      p.el.sil.classList.toggle("hi", active === p.side);
    });
  }
  draw();

  const B = register(stage, (dt) => {
    let moving = stepS(lean, dt);
    moving = stepS(needleSpring, dt) || moving;
    for (const p of pads) moving = stepS(p.depth, dt) || moving;
    draw();
    return moving;
  });
  bag.add(B.unregister);
  const retarget = () => {
    active = 0;
    if (cursor && Math.abs(cursor[0]) <= 55 && Math.abs(cursor[1]) <= 41) {
      active = Math.abs(cursor[0] + PAD_X) < Math.abs(cursor[0] - PAD_X) ? -1 : 1;
      lean.t = active < 0 ? 3.5 : -3.5;
      needleSpring.t = -90 + clamp(cursor[0] / 55, -1, 1) * angleValue;
      pads.forEach((p) => { p.depth.t = p.side === active ? 0.25 : 3.2; });
      read.textContent = active < 0 ? "left" : "right";
    } else {
      lean.t = 0; needleSpring.t = -90;
      pads.forEach((p) => { p.depth.t = 3.2; });
      read.textContent = "rest";
    }
    drawn = ""; B.wake();
  };
  bag.add(pointer(stage, {
    move: (p) => { cursor = unproj(C, p[0], p[1], 6); retarget(); },
    leave: () => { cursor = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { angleValue = v; if (cursor) retarget(); }, destroy: bag.dispose };
}

hairline({
  name: "scale",
  means: "A bathroom scale settles under one foot while its needle follows the pointer.",
  rules: [1, 3, 5, 8, 9],
  range: [24, 42, 60],
  mount,
});
