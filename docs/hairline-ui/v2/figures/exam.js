/** An answer sheet of empty bubbles and ruled rows; its diagonal pencil follows the chosen bubble. */
const { Cam, clamp, circ, facing, fit, fillet, open, poly, proj, rings, prism, unproj, disposer, mk, register, pointer, tween, tset, tval, tdone } = HL;

const ROWS = [-42, -21, 0, 21, 42], COLS = [-36, -12, 12, 36], HOME = 19;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value, active = -1;
  const C = Cam(45,0.5,1.62);
  fit(C,[[-74,-78,0],[-74,78,0],[74,-78,0],[74,78,0],[-74,-78,8],[-74,78,8],[74,-78,8],[74,78,8]],200,164);
  const P=proj(C), front=facing(C), [outer,inner]=rings(-72,-64,72,64,7,1.5), sheet=prism(P,front,outer,inner,0,3.5);
  mk("path",{d:sheet.sil,class:"sil"},svg); mk("path",{d:sheet.crease,class:"lo nf"},svg);
  // A margin and separators keep the bubbles grouped as answer rows.
  mk("path",{d:open([P(-52,-54,4),P(-52,54,4)]),class:"lo nf"},svg);
  ROWS.slice(0,-1).forEach(y=>mk("path",{d:open([P(-47,y+10.5,4),P(55,y+10.5,4)]),class:"lo nf"},svg));
  const bubbles=[];
  for(let r=0;r<ROWS.length;r++) for(let c=0;c<COLS.length;c++) {
    const el=mk("path",{class:"lo nf"},svg);
    el.setAttribute("d",poly(circ(6.2,16).map(q=>P(COLS[c]+q.u,ROWS[r]+q.v,4)))); bubbles.push(el);
  }
  const pencil=mk("path",{class:"sil"},svg), groove=mk("path",{class:"lo nf"},svg), band=mk("path",{class:"lo nf"},svg), lead=mk("path",{class:"lo nf"},svg);
  const px=tween(COLS[3]+8), py=tween(ROWS[4]);
  const homeTip=[COLS[3]+8,ROWS[4]];
  function pencilShape(x,y) {
    const dx=0.78,dy=-0.63,nx=-dy,ny=dx,L=31,w=2.7;
    const q=(t,s)=>[x+dx*t+nx*s,y+dy*t+ny*s];
    const outline=fillet([q(0,0),q(4,w),q(L-4,w),q(L,w*0.55),q(L,-w*0.55),q(L-4,-w),q(4,-w)],[0.2,0.8,1.2,1.5,1.5,1.2,0.8]);
    pencil.setAttribute("d",poly(outline.map(p=>P(p[0],p[1],6))));
    groove.setAttribute("d",open([P(...q(6,0),6),P(...q(L-5,0),6)]));
    band.setAttribute("d",open([P(...q(L-7,-w),6),P(...q(L-7,w),6)]));
    lead.setAttribute("d",open([P(...q(0,0),6),P(...q(3,0),6)]));
  }
  pencilShape(...homeTip);
  const homeBubble=HOME;
  function highlight(i) { bubbles.forEach((el,k)=>el.classList.toggle("hi",k===(i<0?homeBubble:i))); }
  highlight(-1);
  function hit([sx,sy]) {
    const [x,y]=unproj(C,sx,sy,4);
    if(x < -61 || x > 61 || y < -55 || y > 55) return -1;
    let r=0,c=0;
    ROWS.forEach((v,i)=>{if(Math.abs(y-v)<Math.abs(y-ROWS[r]))r=i;});
    COLS.forEach((v,i)=>{if(Math.abs(x-v)<Math.abs(x-COLS[c]))c=i;});
    return Math.abs(y-ROWS[r])<13 && Math.abs(x-COLS[c])<16 ? r*COLS.length+c : -1;
  }
  const loop=register(stage,(_dt,now)=>{
    const x=tval(px,now),y=tval(py,now); pencilShape(x,y);
    return !tdone(px,now)||!tdone(py,now);
  });
  bag.add(loop.unregister);
  function setActive(i) {
    if(i===active)return;
    active=i;
    const target=i<0?homeTip:[COLS[i%COLS.length]+8,ROWS[Math.floor(i/COLS.length)]], f=i<0?1:reach, now=performance.now();
    tset(px,homeTip[0]+(target[0]-homeTip[0])*f,now,0);
    tset(py,homeTip[1]+(target[1]-homeTip[1])*f,now,0);
    highlight(i); read.textContent=i<0?"rest":`${Math.floor(i/COLS.length)+1}·${String.fromCharCode(65+i%COLS.length)}`;
    loop.wake();
  }
  bag.add(pointer(stage,{move:p=>setActive(hit(p)),leave:()=>setActive(-1)}));
  bag.add(()=>svg.replaceChildren());
  return {set:v=>{reach=v;if(active>=0){const i=active;active=-2;setActive(i);}},destroy:bag.dispose};
}

hairline({
  name: "exam",
  means: "A diagonal pencil slides along an answer sheet and points beside an empty bubble.",
  rules: [1, 3, 4, 5, 8, 9],
  range: [0.55, 0.8, 1],
  mount,
});
