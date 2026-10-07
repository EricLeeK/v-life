/** A desk clock with a bounded, pointer-led hand: today's attention has a place. */
const { Cam, fit, proj, rrect, circ, ringAt, poly, open, hull, mk, solid, put,
  facing, rings, prism, clamp, spring, stepS, pointer, register, disposer }=HL;
function mount({stage,svg,read},value){
  const bag=disposer(), C=Cam(45,.5,2.65);
  fit(C,[[-44,-13,0],[44,19,84],[-44,19,84],[44,-13,0]],200,166);
  const P=proj(C), front=facing(C), g=mk('g',{},svg), angle=spring(-.62);
  let strength=value, last=NaN, over=null;
  for(const a of [-24,24]){
    const [r,i]=rings(a-5,0,a+5,25,3,1);
    put(solid(g),prism(P,front,r,i,0,8));
  }
  const circle=circ(36,72), back=circle.map(q=>P(q.u,-8,q.v+46)), face=circle.map(q=>P(q.u,9,q.v+46));
  const body=solid(g);put(body,{sil:poly(hull(back.concat(face))),crease:open(face.slice(9,55))});
  mk('path',{d:poly(circle.map(q=>P(q.u*.88,10,q.v*.88+46))),class:'sil'},g);
  let ticks='';
  for(let i=0;i<12;i++){const a=i*Math.PI/6; ticks+=open([P(Math.sin(a)*28,11,46+Math.cos(a)*28),P(Math.sin(a)*(i%3?25:23),11,46+Math.cos(a)*(i%3?25:23))]);}
  mk('path',{d:ticks,class:'nf lo'},g);
  const hour=mk('path',{class:'nf'},g), minute=mk('path',{class:'nf hi'},g);
  mk('path',{d:poly(circ(2,24).map(q=>P(q.u,13,q.v+46))),class:'sil'},g);
  function draw(){
    if(last===angle.x)return; last=angle.x;
    minute.setAttribute('d',open([P(0,12,46),P(Math.sin(angle.x)*25,12,46+Math.cos(angle.x)*25)]));
    const a=1.08+(angle.x+.62)*.13;
    hour.setAttribute('d',open([P(0,12,46),P(Math.sin(a)*17,12,46+Math.cos(a)*17)]));
  }
  const B=register(stage,dt=>{const m=stepS(angle,dt);draw();return m;});
  const aim=p=>{over=p;angle.t=p?-.62+clamp((p[0]-200)/110,-1,1)*strength:-.62;read.textContent=p?'focus':'rest';B.wake();};
  bag.add(B.unregister);bag.add(pointer(stage,{move:aim,leave:()=>aim(null)}));bag.add(()=>svg.replaceChildren());draw();
  return{set:v=>{strength=v;aim(over);},destroy:bag.dispose};
}
hairline({name:'focus',means:'A small desk clock turns its hand with the pointer and returns to its resting hour.',rules:[1,3,5,8,9],range:[.7,1.5,2.2],mount});
