const {
  Cam, clamp, circ, facing, fit, open, poly, prism, proj, put, rings, seg,
  spring, stepS, disposer, mk, pointer, register, solid, unproj,
} = HL;

const ROLL = 40, ATTACH = 18, WIDTH = 9;

function mount({ stage, svg, read }, value) {
  const bag = disposer(), C = Cam(45, 0.5, 3.7);
  fit(C, [[-72, -27, -2], [66, 27, -2], [66, -27, 3], [-72, 27, 3]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  const spool = solid(g), coil = mk("path", { class: "nf lo" }, g);
  const ring = circ(22, 24).map((q) => ({ u: q.u + ROLL, v: q.v }));
  const inner = circ(20, 24).map((q) => ({ u: q.u + ROLL, v: q.v }));
  put(spool, prism(P, front, ring, inner, -1, 1));
  coil.setAttribute("d", open(circ(15, 24).map((q) => P(ROLL + q.u, q.v, 1.05))) + open(circ(9, 24).map((q) => P(ROLL + q.u, q.v, 1.05))));
  const hub = solid(g);
  put(hub, prism(P, front, circ(7.5, 20).map((q) => ({ u: q.u + ROLL, v: q.v })), circ(5.5, 20).map((q) => ({ u: q.u + ROLL, v: q.v })), 1, 2));
  const tail = solid(g), ticks = mk("path", { class: "nf lo" }, g), endMark = mk("path", { class: "hi" }, g);
  const length = spring(value * 0.44, { eps: 0.03 });
  let maxLength = value, pointerAt = null, active = false, drawn = NaN;

  function draw(len) {
    if (len === drawn) return;
    drawn = len;
    const x1 = ATTACH, x0 = ATTACH - len;
    const [outer, inset] = rings(x0, -WIDTH / 2, x1, WIDTH / 2, 3, 1);
    put(tail, prism(P, front, outer, inset, -0.35, 0.1));
    tail.sil.classList.toggle("hi", active);
    const d = [], step = 4.5;
    for (let x = x0 + 4; x < x1 - 1; x += step) {
      const long = Math.round((x - x0) / step) % 4 === 0;
      d.push(seg(P(x, -WIDTH / 2 + 0.8, 0.12), P(x, long ? WIDTH / 2 - 0.8 : 0.4, 0.12)));
    }
    ticks.setAttribute("d", d.join(""));
    endMark.setAttribute("d", seg(P(x0 + 2, -WIDTH / 2 + 1, 0.14), P(x0 + 2, WIDTH / 2 - 1, 0.14)));
    endMark.classList.toggle("hi", !active);
  }
  const retarget = () => {
    if (pointerAt && pointerAt[0] >= ROLL - 22 - maxLength && pointerAt[0] <= ROLL + 23 && Math.abs(pointerAt[1]) <= 14) {
      active = true;
      length.t = clamp(ATTACH - pointerAt[0] + 23, 28, maxLength);
      read.textContent = `tape ${Math.max(1, Math.round(length.t / 4.5))}`;
    } else {
      active = false; length.t = Math.min(maxLength, value * 0.44); read.textContent = "rest";
    }
    drawn = NaN; B.wake();
  };
  draw(length.x);
  const B = register(stage, (dt) => {
    const moving = stepS(length, dt);
    draw(length.x);
    return moving;
  });
  bag.add(B.unregister);
  bag.add(pointer(stage, {
    move: (p) => { pointerAt = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { pointerAt = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  return {
    set: (v) => { value = v; maxLength = v; if (pointerAt) retarget(); else { length.t = v * 0.44; drawn = NaN; B.wake(); } },
    destroy: bag.dispose,
  };
}

hairline({
  name: "tape",
  means: "A tailor's tape uncoils from its round roll, leaving short measuring ticks behind.",
  rules: [1, 3, 5, 9, 10],
  range: [60, 74, 88],
  mount,
});
