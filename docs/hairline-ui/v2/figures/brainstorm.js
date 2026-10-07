/** A sculpted brain, with rounded gyri and little thoughts that gather and scatter. */
const {Cam,fit,proj,mk,solid,put,poly,open,fillet,circ,clamp,
  spring,stepS,pointer,register,disposer}=HL;
function mount({stage,svg,read},value){
  const bag=disposer(),C=Cam(45,.5,2.05);
  fit(C,[[-84,-15,-6],[85,28,120],[-84,28,120],[85,-15,-6]],200,162);
  const P=proj(C),g=mk('g',{},svg),body=mk('g',{},g),lift=spring(0);
  let strength=value,over=null,active=-1,drawn='';
  // The uneven lobed perimeter and tapered brainstem distinguish a brain from two balls.
  const contour=[[-46,36],[-51,42],[-49,51],[-41,56],[-41,64],[-34,71],
    [-25,72],[-20,68],[-12,77],[0,80],[11,76],[15,70],[24,74],[34,68],
    [37,60],[35,56],[45,52],[50,44],[46,35],[38,27],[26,22],[20,22],
    [19,14],[16,10],[10,10],[7,15],[9,22],[1,26],[-7,23],[-17,24],
    [-25,29],[-35,28],[-43,32]];
  const profile=fillet(contour,contour.map(()=>4),6);
  const brainPoint=(x,y,z)=>P((x+y)*Math.SQRT1_2,(-x+y)*Math.SQRT1_2,z);
  const back=profile.map(([x,z])=>brainPoint(x,6,z+1)),face=profile.map(([x,z])=>brainPoint(x,9,z));
  const rim=solid(body);
  put(rim,{sil:poly(back),crease:''});rim.sil.classList.add('lo');
  const cortex=mk('path',{d:poly(face),class:'sil hi'},body);
  // Interlocking rounded folds follow the lobe contours; no letters or drawn glyphs.
  const folds=[
    [[-41,45],[-34,48],[-36,57],[-27,63],[-22,58],[-14,60],[-12,70]],
    [[-33,33],[-27,39],[-29,48],[-20,51],[-14,45],[-7,46]],
    [[-18,30],[-9,31],[-7,39],[1,43],[-2,52],[7,58],[4,69]],
    [[15,68],[13,57],[21,53],[20,44],[29,40],[28,30]],
    [[31,61],[29,54],[37,49],[35,40],[41,37]],
    [[-4,25],[4,29],[9,25],[17,30],[16,39],[9,44]],
    [[11,13],[13,17],[14,22]],
    [[-36,58],[-30,57],[-29,53],[-24,54]],
    [[1,59],[0,64],[-6,66],[-8,62]],
  ];
  const curve=points=>{
    const p=points.map(([x,z])=>brainPoint(x,9.5,z));let d=`M${p[0]} `;
    for(let k=1;k<p.length-1;k++)d+=`Q${p[k]} ${(p[k][0]+p[k+1][0])/2},${(p[k][1]+p[k+1][1])/2} `;
    return d+`T${p.at(-1)}`;
  };
  mk('path',{d:folds.map(curve).join(' '),class:'nf'},body);
  const seeds=[[-75,16,76],[-29,0,103],[22,-3,108],[78,-8,94]];
  const thoughts=seeds.map((p,i)=>({p,i,s:spring(0),shape:mk('path',{class:'sil'},g),trail:mk('path',{class:'nf lo'},g)}));
  function draw(){
    const key=[lift.x,...thoughts.map(t=>t.s.x)].map(n=>n.toFixed(3)).join(',')+active;
    if(key===drawn)return;drawn=key;
    body.setAttribute('transform',`translate(0 ${-lift.x*2})`);
    cortex.classList.toggle('hi',active<0);
    for(const t of thoughts){
      const q=t.s.x,dx=t.p[0]/75,dz=(t.p[2]-46)/70;
      const a=t.p[0]+dx*q*strength,z=t.p[2]+dz*q*strength;
      const center=P(a,t.p[1],z),r=4.3+t.i*.3;
      t.shape.setAttribute('d',poly(circ(r,32).map(v=>[center[0]+v.u,center[1]+v.v])));
      t.shape.classList.toggle('hi',active===t.i);
      const tail=P(a-dx*(6+q*5),t.p[1],z-dz*(6+q*5));
      const end=P(a-dx*(11+q*8),t.p[1],z-dz*(11+q*8));
      t.trail.setAttribute('d',open([tail,end]));
    }
  }
  const B=register(stage,dt=>{
    let moving=stepS(lift,dt);thoughts.forEach(t=>{moving=stepS(t.s,dt)||moving;});draw();return moving;
  });
  function aim(p){
    over=p;active=-1;lift.t=p?1:0;
    if(p){let best=Infinity;thoughts.forEach(t=>{const c=P(...t.p),d=Math.hypot(c[0]-p[0],c[1]-p[1]);if(d<best){best=d;active=t.i;}t.s.t=.22+.78*clamp(1-d/165,0,1);});}
    else thoughts.forEach(t=>t.s.t=0);
    read.textContent=p?`thought ${active+1}`:'rest';B.wake();
  }
  bag.add(B.unregister);bag.add(pointer(stage,{move:aim,leave:()=>aim(null)}));bag.add(()=>svg.replaceChildren());draw();
  return {set:v=>{strength=v;drawn='';aim(over);},destroy:bag.dispose};
}
hairline({name:'brainstorm',means:'An open mind sends little thoughts outward, then gathers them back.',rules:[1,3,5,7,8,9],range:[10,22,30],mount});
