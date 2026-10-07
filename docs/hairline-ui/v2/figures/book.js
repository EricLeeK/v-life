/** An open book with a raised spine and five offset leaves that fan under the pointer. */
const { Cam, clamp, facing, fillet, fit, open, poly, proj, rad, rings, rrect, prism, unproj, disposer, mk, register, pointer, tween, tset, tval, tdone } = HL;

const N = 5, SIDE = 75, BACK = -49, FRONT = 49;
const EDGE = [-9, -4, 0, 6, 11], REST_LIFT = [0.8, 0, 2.4, 0.6, 1.2];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value, active = -1;
  const C = Cam(45, 0.5, 1.55);
  fit(C, [[-86,-65,0],[-86,65,0],[86,-65,0],[86,65,0],[-86,-65,18],[-86,65,18],[86,-65,18],[86,65,18]], 200, 164);
  const P = proj(C), front = facing(C);
  function slab(x0,x1,y0,y1,z0,z1,r,b,cls) {
    const [outer,inner] = rings(x0,y0,x1,y1,r,b), q = prism(P,front,outer,inner,z0,z1), g = mk("g",{},svg);
    mk("path",{d:q.sil,class:cls},g); mk("path",{d:q.crease,class:"lo nf"},g); return g;
  }
  slab(-77,-4,-57,57,0,3,7,1.4,"sil");
  slab(4,77,-57,57,0,3,7,1.4,"sil");
  slab(-9,9,-59,59,1,8,6,1.2,"lo");
  const spine = mk("path", { d: open([P(0,-53,8),P(0,53,8)]), class: "lo nf" }, svg);
  const pages = Array.from({length:N}, (_,i) => ({
    face: [mk("path",{class:"sil"},svg),mk("path",{class:"sil"},svg)],
    crease: [mk("path",{class:"lo nf"},svg),mk("path",{class:"lo nf"},svg)],
    lift: tween(REST_LIFT[i]), fan: tween(0),
  }));
  const baseZ = (i) => 4 + i * 0.72;
  function leafPoints(i, side, lift, fan, inset = 0) {
    const offset = EDGE[i] + fan;
    const near = (x, y) => baseZ(i) + lift * Math.pow(clamp((y - BACK) / (FRONT - BACK), 0, 1), 1.7) * (0.25 + 0.75 * Math.abs(x) / SIDE);
    const xi = side * (7 + inset), xo = side * (SIDE - inset), y0 = BACK + offset + inset, y1 = FRONT + offset - inset;
    return fillet([[xi,y0],[xo,y0],[xo,y1],[xi,y1]],[2.5,2.5,2.5,2.5]).map(([x,y])=>P(x,y,near(x,y)));
  }
  function drawPage(i, lift, fan) {
    const pg = pages[i];
    [-1,1].forEach((side,k) => {
      pg.face[k].setAttribute("d", poly(leafPoints(i,side,lift,fan)));
      const pts = leafPoints(i,side,lift,fan,2.5);
      pg.crease[k].setAttribute("d", open([pts[0],pts[1],pts[2]]));
    });
  }
  function drawAll() { const now=performance.now(); pages.forEach((p,i) => { const lift=tval(p.lift,now), fan=tval(p.fan,now); drawPage(i,lift,fan); p.lift.drawn=lift; p.fan.drawn=fan; }); }
  drawAll();
  const restEdges = EDGE.map((v,i) => P(65, 43 + v, baseZ(i) + REST_LIFT[i]));
  function hit([sx,sy]) {
    const [x,y] = unproj(C,sx,sy,5);
    if (Math.abs(x) < 38 || Math.abs(x) > 80 || y < 31 || y > 62) return -1;
    let best = -1, d = Infinity;
    restEdges.forEach((q,i) => { const n = Math.hypot(sx-q[0],sy-q[1]); if (n < d) { d=n; best=i; } });
    return d < 25 ? best : -1;
  }
  const home = 2;
  function highlight(i) {
    pages.forEach((p,k) => p.face[1].classList.toggle("hi", k === (i < 0 ? home : i)));
  }
  highlight(-1);
  const loop = register(stage,(_dt,now) => {
    let moving = false;
    pages.forEach((p,i) => {
      const lift=tval(p.lift,now), fan=tval(p.fan,now);
      if (Math.abs(lift-p.lift.drawn)>0.01 || Math.abs(fan-p.fan.drawn)>0.01) { drawPage(i,lift,fan); p.lift.drawn=lift; p.fan.drawn=fan; }
      if (!tdone(p.lift,now)||!tdone(p.fan,now)) moving=true;
    });
    return moving;
  });
  bag.add(loop.unregister);
  function setActive(i) {
    if (i === active) return;
    const from = active < 0 ? (i < 0 ? home : i) : active, now = performance.now();
    active = i;
    pages.forEach((p,k) => {
      const d=Math.abs(k-from), is=i===k, dir=k<from?-1:1;
      tset(p.lift, i<0 ? REST_LIFT[k] : REST_LIFT[k]+(is?reach+5:1.4/(d+1)), now, d*44);
      tset(p.fan, i<0 ? 0 : is?reach*0.72:dir*reach*0.12, now, d*44);
    });
    highlight(i);
    read.textContent=i<0?"rest":`page ${i+1}`;
    loop.wake();
  }
  bag.add(pointer(stage,{move:(p)=>setActive(hit(p)),leave:()=>setActive(-1)}));
  bag.add(()=>svg.replaceChildren());
  return { set:(v)=>{reach=v;if(active>=0){const i=active;active=-2;setActive(i);}}, destroy:bag.dispose };
}

hairline({
  name: "book",
  means: "An open book fans and lifts its near side pages as the pointer passes.",
  rules: [1, 2, 3, 4, 5, 9],
  range: [4, 8, 13],
  mount,
});
