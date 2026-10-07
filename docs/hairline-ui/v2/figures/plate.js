const {
  Cam, clamp, circ, facing, fit, hull, open, poly, prism, proj, put, rad,
  ringAt, seg, spring, stepS, disposer, mk, pointer, register, solid, unproj,
} = HL;

const OUT = circ(48, 24), RIM = circ(42, 24), WELL = circ(30, 24);

function mount({ stage, svg, read }, value) {
  const bag = disposer(), C = Cam(45, 0.5, 2.15);
  fit(C, [[-52, -54, -5], [110, 46, -5], [110, -54, 8], [-52, 46, 8]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  const dish = solid(g), inner = mk("path", { class: "nf lo" }, g);
  const mark = mk("path", { class: "hi" }, g);
  const fork = mk("path", { class: "nf" }, g), spoon = mk("path", { class: "nf" }, g);
  const ax = spring(0, { eps: 0.02 }), ay = spring(0, { eps: 0.02 });
  let strength = value, cursor = null, over = false, drawn = "";

  const warp = (x, y, z, a, b) => {
    const cb = Math.cos(rad(b)), sb = Math.sin(rad(b)), ca = Math.cos(rad(a)), sa = Math.sin(rad(a));
    const xx = x * cb + z * sb, zz = -x * sb + z * cb;
    return P(xx, y * ca - zz * sa, y * sa + zz * ca);
  };
  const top = (ring, a, b) => ring.map((q) => warp(q.u, q.v, 0, a, b));
  function draw(a, b) {
    const key = `${a},${b}`;
    if (key === drawn) return;
    drawn = key;
    const lid = top(OUT, a, b), base = ringAt(P, OUT, -2);
    put(dish, { sil: poly(hull(base.concat(lid))), crease: open(top(RIM, a, b)) });
    dish.sil.classList.toggle("hi", over);
    mark.setAttribute("d", open(top(OUT.slice(0, 5), a, b)));
    mark.classList.toggle("hi", !over);
    inner.setAttribute("d", open(top(WELL, a, b)));

    const u = (x, y) => warp(x, y, 0.25, a * 0.32, b * 0.32);
    const f = [];
    for (let i = 0; i < 4; i++) {
      const y = -15 + i * 3.2;
      f.push(seg(u(65, y), u(72, y)), seg(u(72, y), u(75, -10.2)), seg(u(75, -10.2), u(105, -10.2)));
    }
    fork.setAttribute("d", f.join(""));
    const bowl = circ(1, 16).map((q) => u(65 + q.u * 4.6, 12 + q.v * 6.5));
    spoon.setAttribute("d", poly(bowl) + seg(u(69, 12), u(105, 12)) + seg(u(70, 10.8), u(105, 10.8)) + seg(u(70, 13.2), u(105, 13.2)));
  }
  draw(0, 0);

  const B = register(stage, (dt) => {
    const moving = stepS(ax, dt) | stepS(ay, dt);
    draw(ax.x, ay.x);
    return !!moving;
  });
  bag.add(B.unregister);
  const retarget = () => {
    if (cursor && Math.hypot(cursor[0], cursor[1]) <= 48) {
      over = true;
      ax.t = clamp(cursor[1] / 48, -1, 1) * strength;
      ay.t = clamp(-cursor[0] / 48, -1, 1) * strength;
      read.textContent = "plate";
    } else {
      over = false; ax.t = 0; ay.t = 0; read.textContent = "rest";
    }
    drawn = ""; B.wake();
  };
  bag.add(pointer(stage, {
    move: (p) => { cursor = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { cursor = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  return {
    set: (v) => { strength = v; if (cursor) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "plate",
  means: "An empty dinner plate tips gently; the fork and spoon follow its lean.",
  rules: [1, 3, 5, 9],
  range: [4, 10, 15],
  mount,
});
