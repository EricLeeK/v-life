/** A clipboard with four tactile switches; the touched switch slides and its neighbours follow. */
const { Cam, clamp, fillet, fit, open, poly, proj, rad, disposer, mk, register, pointer, tween, tset, tval, tdone } = HL;

const ROWS = 4, ROW_Z = [116, 86, 56, 26], TRACK_X = -33, REST = [-7, -4, 5, -5];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let follow = value, active = -1;
  const C = Cam(45, 0.5, 1.78);
  fit(C, [[-62, 1, 0], [62, 1, 0], [-62, 1, 156], [62, 1, 156], [-70, -10, 161], [70, -10, 161]], 200, 162);
  const P = proj(C), front = (q) => q.u + q.v > 0;
  const faceAt = (pts) => pts.map(([x,z]) => P(x, 4, z));
  const round = (x0,z0,x1,z1,r) => fillet([[x0,z0],[x1,z0],[x1,z1],[x0,z1]],[r,r,r,r]);
  const board = mk("path", { d: poly(faceAt(round(-58, 7, 58, 148, 6))), class: "sil" }, svg);
  mk("path", { d: open(faceAt(round(-54, 11, 54, 144, 4))), class: "lo nf" }, svg);
  // A folded lip and the sprung metal clip make the top unmistakably a clipboard.
  mk("path", { d: poly(faceAt(round(-25, 139, 25, 154, 4))), class: "lo" }, svg);
  mk("path", { d: open(faceAt([[-20,151],[-18,157],[-12,160],[12,160],[18,157],[20,151]])), class: "sil" }, svg);
  mk("path", { d: open(faceAt([[-14,150],[-12,155],[12,155],[14,150]])), class: "lo nf" }, svg);
  const tracks = [], knobs = [], rails = [], states = REST.map((x) => tween(x));
  for (let i = 0; i < ROWS; i++) {
    const z = ROW_Z[i], track = round(TRACK_X - 18, z - 8, TRACK_X + 18, z + 8, 4);
    tracks.push(mk("path", { d: poly(faceAt(track)), class: "lo" }, svg));
    mk("path", { d: open(faceAt([[TRACK_X-14,z-5.5],[TRACK_X-14,z+5.5]])), class: "lo nf" }, svg);
    mk("path", { d: open(faceAt([[TRACK_X+14,z-5.5],[TRACK_X+14,z+5.5]])), class: "lo nf" }, svg);
    knobs.push(mk("path", { class: "sil" }, svg));
    const end = i % 2 ? 37 : 43;
    rails.push(mk("path", { d: open(faceAt([[-10,z+1],[end,z+1],[-10,z-4],[end-11,z-4]])), class: "lo nf" }, svg));
  }
  const hitCenters = ROW_Z.map((z) => P(TRACK_X, 4, z));
  function draw(i, x) {
    const z = ROW_Z[i], pts = faceAt(round(TRACK_X - 7 + x, z - 5.2, TRACK_X + 7 + x, z + 5.2, 3));
    knobs[i].setAttribute("d", poly(pts));
  }
  ROWS && ROW_Z.forEach((_, i) => draw(i, REST[i]));
  const highlight = (r) => {
    const row = r < 0 ? 1 : r;
    tracks.forEach((el, i) => el.classList.toggle("hi", i === row));
    rails.forEach((el, i) => el.classList.toggle("hi", i === row));
  };
  highlight(-1);
  function hit([sx, sy]) {
    const corners = [[-58,7],[58,7],[-58,148],[58,148]].map(([x,z]) => P(x,4,z));
    const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
    if (sx < Math.min(...xs) - 3 || sx > Math.max(...xs) + 3 || sy < Math.min(...ys) - 2 || sy > Math.max(...ys) + 2) return -1;
    let best = 0;
    hitCenters.forEach((p, i) => { if (Math.abs(sy - p[1]) < Math.abs(sy - hitCenters[best][1])) best = i; });
    return Math.abs(sy - hitCenters[best][1]) < 18 ? best : -1;
  }
  const loop = register(stage, (_dt, now) => {
    let moving = false;
    states.forEach((s, i) => { const x = tval(s, now); draw(i, x); if (!tdone(s, now)) moving = true; });
    return moving;
  });
  bag.add(loop.unregister);
  function setActive(r) {
    if (r === active) return;
    const from = active < 0 ? r : active, now = performance.now();
    active = r;
    states.forEach((s, i) => {
      const distance = Math.abs(i - from), target = r < 0 ? REST[i] : REST[i] + (i === r ? 10 - REST[i] : follow / (distance + 1));
      tset(s, target, now, distance * 42);
      tracks[i].classList.toggle("hi", i === (r < 0 ? 1 : r));
      rails[i].classList.toggle("hi", i === (r < 0 ? 1 : r));
    });
    read.textContent = r < 0 ? "rest" : `row ${r + 1}`;
    loop.wake();
  }
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { follow = v; if (active >= 0) { const r = active; active = -2; setActive(r); } }, destroy: bag.dispose };
}

hairline({
  name: "checklist",
  means: "Four sliding checkbox switches sit on a clipped board; the touched row moves first.",
  rules: [1, 2, 4, 5, 8, 9],
  range: [1.5, 3.5, 6],
  mount,
});
