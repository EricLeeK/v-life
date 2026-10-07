/** A horizontal pocket compass: an overview gives the day a direction. */
const {Cam,fit,proj,unproj,circ,rrect,ringAt,poly,open,fillet,facing,prism,put,solid,mk,
  clamp,spring,stepS,pointer,register,disposer}=HL;
function mount({stage,svg,read},value){
  const bag=disposer(),C=Cam(45,.5,2.35);
  fit(C,[[-56,-69,0],[56,55,16],[-56,55,0],[56,-69,16]],200,166);
  const P=proj(C),front=facing(C),g=mk('g',{},svg),angle=spring(-.55);
  let strength=value,last=NaN,over=null;
  const eye=rrect(-11,-67,11,-45,10,16),eyeInner=rrect(-7,-63,7,-49,6,16);
  put(solid(g),prism(P,front,eye,eyeInner,3,7));
  const ring=circ(50,96),inner=circ(47,96);
  put(solid(g),prism(P,front,ring,inner,0,12));
  mk('path',{d:poly(ringAt(P,circ(41,96),13)),class:'sil'},g);
  let ticks='';
  for(let k=0;k<24;k++){const a=k*Math.PI/12;const length=k%6===0?6:3;ticks+=open([P(Math.sin(a)*38,Math.cos(a)*38,13),P(Math.sin(a)*(38-length),Math.cos(a)*(38-length),13)]);}
  mk('path',{d:ticks,class:'nf lo'},g);
  const needle=mk('path',{class:'sil'},g),tip=mk('path',{class:'nf hi'},g);
  const center=solid(g);put(center,prism(P,front,circ(4,32),circ(3,32),16,18));
  const shape=fillet([[-5,0],[0,-32],[5,0],[0,32]],[1,1,1,1],6);
  function draw(){
    if(last===angle.x)return;last=angle.x;
    const point=(x,y,z=15)=>P(x*Math.cos(angle.x)-y*Math.sin(angle.x),x*Math.sin(angle.x)+y*Math.cos(angle.x),z);
    needle.setAttribute('d',poly(shape.map(([x,y])=>point(x,y))));
    tip.setAttribute('d',open([point(-4,0,15.2),point(0,-29,15.2),point(4,0,15.2)]));
    g.append(center.g);
  }
  const B=register(stage,dt=>{const m=stepS(angle,dt);draw();return m;});
  function aim(p){over=p;const q=p?unproj(C,p[0],p[1],12):null;angle.t=q?-.55+clamp(q[0]/45,-1,1)*strength:-.55;read.textContent=p?'bearing':'rest';B.wake();}
  bag.add(B.unregister);bag.add(pointer(stage,{move:aim,leave:()=>aim(null)}));bag.add(()=>svg.replaceChildren());draw();
  return{set:v=>{strength=v;aim(over);},destroy:bag.dispose};
}
hairline({name:'compass',means:'A pocket compass follows a nearby direction, then finds its resting bearing.',rules:[1,3,5,8,9],range:[.4,.85,1.2],mount});
