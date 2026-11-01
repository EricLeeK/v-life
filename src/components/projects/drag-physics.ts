export const MAX_TILT = 4.5;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max,n));
export const createDragBody = (x: number,y: number) => ({ x,y,vx:0,vy:0,angle:0,angularVelocity:0,pointerVelocity:0,lastTargetX:x });
export type DragBody = ReturnType<typeof createDragBody>;
export function stepDragBody(body: DragBody, targetX: number,targetY: number,elapsed: number,dragging=true) {
  const dt=clamp(elapsed,1/1000,1/30);
  const velocity=(targetX-body.lastTargetX)/dt;
  body.lastTargetX=targetX;
  body.pointerVelocity+=(velocity-body.pointerVelocity)*(1-Math.exp(-dt/.045));
  const targetAngle=dragging ? clamp(body.pointerVelocity*.008,-MAX_TILT,MAX_TILT):0;
  const steps=Math.ceil(dt/(1/240)); const h=dt/steps;
  for(let i=0;i<steps;i++) {
    body.vx+=((targetX-body.x)*850-body.vx*46)*h;
    body.vy+=((targetY-body.y)*850-body.vy*46)*h;
    body.x+=body.vx*h; body.y+=body.vy*h;
    body.angularVelocity+=((targetAngle-body.angle)*340-body.angularVelocity*27)*h;
    body.angle=clamp(body.angle+body.angularVelocity*h,-MAX_TILT,MAX_TILT);
    if(Math.abs(body.angle)===MAX_TILT && Math.sign(body.angularVelocity)===Math.sign(body.angle)) body.angularVelocity=0;
  }
  return body;
}
