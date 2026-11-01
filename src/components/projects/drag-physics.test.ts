import { expect, it } from 'vitest';
import { createDragBody, stepDragBody } from './drag-physics';
it('clamps fast reversals and returns upright without a new pointer event', () => {
  const body=createDragBody(0,0);
  for(let i=1;i<=180;i++) { stepDragBody(body,Math.sin(i/9)*800,0,1/60); expect(Math.abs(body.angle)).toBeLessThanOrEqual(4.5); }
  for(let i=0;i<120;i++) stepDragBody(body,700,90,1/60);
  expect(Math.abs(body.angle)).toBeLessThan(.01);
  expect(body.x).toBeCloseTo(700,2);
});
