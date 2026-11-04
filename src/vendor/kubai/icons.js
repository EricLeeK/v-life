// Copyright (c) 2026 Kubai087. Licensed under the Kubai Icons License; see LICENSE.
/*! Copyright (c) 2026 Kubai087. Licensed under the Kubai Icons License; see LICENSE. */
// The icon set. Each entry: svg(u) builds the layers, target(hover, state) returns the
// numbers for rest or hover, draw(p, E) writes the interpolated numbers back. A contributed
// icon also names its designer's GitHub handle in `by`.

// ---------- Icons ----------
// Fills: u.lo(h) / u.up(h) carry the thin bottom band. Use them only on a flat-bottomed
// rectangle of height h whose bottom is clear: nothing within about 3 units of the edge
// and the piece itself not short. Everything else, and curved shapes, use u.loS / u.upS.
// Marks: on a mid-tone (back) body they are white; on a light (front) body or white
// content they take the deep tint; a supporting object laid over the subject (the
// lens) is deep so it reads as separate. Weights: content lines 1.6, glyphs 2.2.
import { KR, CR, f, R, rp, rr, circ, lines, star, gear, sector, at, CLOCK_MINUTES } from './engine.js';

const OL = 'class="ol" data-t="stroke:#5393FF"';
const LINE = 'class="ln" data-t="stroke:#D3E2FC"';
const ACC = 'class="ln" data-t="stroke:#5393FF"';
const DEEP = 'data-t="fill:#2F6FE0"';
const DEEPS = 'data-t="stroke:#2F6FE0"';
const FOLDER_BACK_R = [KR, 1.4, 1.4, KR, KR, KR];
// Keylines (fills; outside strokes add 1 all round), all centred on (15.5, 12.5) and scaled from the folder's 23-wide body
// (Material's 20 / 18 / 20×16 grid × 1.15): circle Ø23, square 20.6, landscape 23×18.4,
// portrait 18.4×23. Outlines sit 1 unit outside a shape; a coloured band around white
// content keeps 2+ units or is dropped so the content meets the edge.
const GEAR = gear(6, 11.4, 9);
const today = new Date();
const tomorrow = new Date(today.getTime() + 86400000);

export const icons = [
  {
    name: '文件夹',
    accent: '#5393FF',
    svg: (u) => `
      <g filter="${u.sh}"><path data-n="back" fill="${u.lo(21)}"/></g>
      <path data-n="backO" ${OL}/>
      <g data-n="file"><path d="${rr(0, 0, 17, 9, 1)}" fill="#fff"/><path d="M5.5 2.3H11.5" ${LINE} stroke-width="1"/></g>
      <g filter="${u.hi}"><path data-n="front" fill="${u.up(18)}"/></g>
      <path data-n="frontO" ${OL}/>`,
    target: (h) => ({
      back: h ? [[4, 3], [11.2, 3], [14.2, 6], [27, 6], [27.6, 23], [4.6, 23]] : [[4, 2], [11.2, 2], [14.2, 5], [27, 5], [27, 23], [4, 23]],
      fx: h ? 7.9 : 7,
      front: h ? [[6.8, 13], [29.3, 13], [27.6, 23], [5.4, 23]] : [[4, 5], [27, 5], [27, 23], [4, 23]],
      fr: h ? 1.8 : KR
    }),
    draw(p, E) {
      const b = rp(p.back, FOLDER_BACK_R), fr = rp(p.front, p.fr);
      at(E.back, { d: b }); at(E.backO, { d: b });
      at(E.file, { transform: `translate(${f(p.fx)} 9)` });
      at(E.front, { d: fr }); at(E.frontO, { d: fr });
    }
  },
  {
    name: '日历',
    accent: '#F97316',
    svg: (u) => {
      const body = rr(5.2, 3.4, 20.6, 19.4, KR);
      const sheet = rp(R(8.2, 9, 14.6, 10.8), [0, 0, CR, CR]);
      const head = rp(R(5.2, 3.4, 20.6, 5.6), [KR, KR, 0, 0]);
      const ring = rr(10.4, 1.6, 1.8, 3.8, 0.9) + rr(18.8, 1.6, 1.8, 3.8, 0.9);
      return `
      <g filter="${u.sh}"><path d="${body}" fill="${u.loS}"/></g>
      <path d="${sheet}" fill="#fff"/>
      <text x="15.5" y="17.4" text-anchor="middle" font-size="8.4" font-weight="700" data-t="fill:#81B0FF">${tomorrow.getDate()}</text>
      <g data-n="sheet"><path d="${sheet}" fill="#fff"/>
        <text x="15.5" y="17.4" text-anchor="middle" font-size="8.4" font-weight="700" data-t="fill:#4389FF">${today.getDate()}</text>
        <path data-n="shade" d="${sheet}" data-t="fill:#4389FF" opacity="0"/></g>
      <path d="${body}" ${OL}/>
      <g filter="${u.hi}"><path d="${head}" fill="${u.upS}"/></g>
      <path d="${head}" ${OL}/>
      <g data-n="rings"><path d="${ring}" fill="#fff"/><path d="${ring}" ${OL}/></g>`;
    },
    target: (h) => ({ o: h ? 1 : 0, rings: h ? -0.6 : 0 }),
    draw(p, E) {
      // Today's page turns up under the header: it foreshortens toward its top edge and
      // darkens as it faces away, uncovering tomorrow.
      const o = Math.max(0, Math.min(1, p.o));
      const sy = Math.cos(o * Math.PI / 2);
      at(E.sheet, { transform: `translate(0 9) scale(1 ${f(Math.max(0.001, sy))}) translate(0 -9)`, opacity: o > 0.985 ? 0 : 1 });
      at(E.shade, { opacity: f(0.45 * Math.sin(o * Math.PI / 2)) });
      at(E.rings, { transform: `translate(0 ${f(p.rings)})` });
    }
  },
  {
    name: '时钟',
    accent: '#14B8A6',
    svg: (u) => `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${circ(15.5, 12.5, 11.5)}" fill="${u.loS}"/></g></g>
      <path d="${circ(15.5, 12.5, 11.5)}" ${OL}/>
      <path d="${circ(15.5, 12.5, 8.2)}" fill="#fff"/>
      <g filter="${u.hi}"><path data-n="sweep" fill="${u.upS}"/></g>
      <path data-n="hh" d="M15.5 12.5V8.3" stroke-width="2.6" stroke-linecap="round" data-t="stroke:#89B5FF"/>
      <path data-n="mh" d="M15.5 12.5V6.2" stroke-width="2" stroke-linecap="round" data-t="stroke:#2F6FE0"/>
      <circle cx="15.5" cy="12.5" r="1.7" data-t="fill:#2F6FE0"/>`,
    target: (h) => {
      // Time moves on: the hands run 25 minutes forward (10:08 to 10:33, still well apart)
      // and the face marks the stretch passed.
      const m = CLOCK_MINUTES, sw = h ? 150 : 0;
      return { base: m * 6, sw, mA: m * 6 + sw, hA: m / 2 + sw / 12 };
    },
    draw(p, E) {
      at(E.sweep, { d: sector(p.base, Math.max(0, p.sw), 7) });
      at(E.mh, { transform: `rotate(${f(p.mA)} 15.5 12.5)` });
      at(E.hh, { transform: `rotate(${f(p.hA)} 15.5 12.5)` });
    }
  },
  {
    name: '设置',
    accent: '#0EA5E9',
    svg: (u) => `
      <g filter="${u.sh}"><g filter="${u.hi}"><g data-n="gear"><path d="${GEAR}" fill="${u.loS}"/></g></g></g><g data-n="gearO"><path d="${GEAR}" ${OL}/></g>
      <path d="${circ(15.5, 12.5, 5.8)}" fill="#fff"/>
      <g filter="${u.hi}"><path data-n="hub" fill="${u.upS}"/></g>
      <path data-n="hubO" ${OL}/>`,
    target: (h) => ({ rot: h ? 60 : 0, hub: h ? 2.9 : 3.5 }),
    draw(p, E) {
      at(E.gear, { transform: `rotate(${f(p.rot)} 15.5 12.5)` }); at(E.gearO, { transform: `rotate(${f(p.rot)} 15.5 12.5)` });
      const d = circ(15.5, 12.5, p.hub);
      at(E.hub, { d }); at(E.hubO, { d });
    }
  },
  {
    name: '主页',
    accent: '#DC2626',
    // The new-tab home: a house whose door swings open on hover.
    svg: (u) => {
      const roof = rp([[3.6, 12.6], [15.5, 2.4], [27.4, 12.6]], [1.4, 2.2, 1.4]);
      const door = rp(R(13.2, 15.6, 4.6, 7.4), [1.2, 1.2, 0, 0]);
      return `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${rr(7.4, 10.6, 16.2, 12.4, KR)}" fill="${u.loS}"/></g></g>
      <path d="${rr(7.4, 10.6, 16.2, 12.4, KR)}" ${OL}/>
      <path d="${door}" fill="${u.pure('#2F6FE0')}"/>
      <g data-n="door"><path d="${door}" fill="#fff"/></g>
      <g filter="${u.hi}"><path d="${roof}" fill="${u.upS}"/></g>
      <path d="${roof}" ${OL}/>`;
    },
    target: (h) => ({ door: h ? 0.3 : 1 }),
    draw(p, E) {
      at(E.door, { transform: `translate(13.2 0) scale(${f(Math.max(0.001, p.door))} 1) translate(-13.2 0)` });
    }
  },
  {
    name: '购物车',
    accent: '#0EA5E9',
    // A cart; on hover a parcel drops into its basket.
    svg: (u) => {
      const basket = rp([[7, 7], [26.8, 7], [24.6, 16.8], [9.4, 16.8]], [1.4, 1.4, 1.8, 1.8]);
      const box = rr(0, 0, 7.4, 6, 1.2);
      return `<path d="M3.4 3.6H6L9.2 16.8H23" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${DEEPS}/>
        <g data-n="box"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${box}" fill="${u.upS}"/></g></g><path d="${box}" ${OL}/></g>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${basket}" fill="${u.loS}"/></g></g><path d="${basket}" ${OL}/>
        <circle cx="11.4" cy="20.8" r="2" ${DEEP}/><circle cx="21.6" cy="20.8" r="2" ${DEEP}/>`;
    },
    target: (h) => ({ box: h ? [13.6, 3.2, 1] : [13.6, -1.2, 0] }),
    draw(p, E) { at(E.box, { transform: `translate(${f(p.box[0])} ${f(p.box[1])})`, opacity: f(p.box[2]) }); }
  },
  {
    name: '星标',
    accent: '#7C3AED',
    // A star with a lighter star inset; it turns one point on hover.
    svg: (u) => {
      const big = star(11.6, 5.4), small = star(5.6, 2.6);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><g data-n="r1"><path d="${big}" fill="${u.loS}"/></g></g></g>
        <g data-n="r1o"><path d="${big}" ${OL}/></g>
        <g filter="${u.hi}"><g data-n="r2"><path d="${small}" fill="${u.upS}"/></g></g>
        <g data-n="r2o"><path d="${small}" ${OL}/></g>`;
    },
    target: (h) => ({ rot: h ? 72 : 0, s: h ? 1.05 : 1 }),
    draw(p, E) {
      const t = `translate(15.5 13.4) rotate(${f(p.rot)}) scale(${f(p.s)})`;
      ['r1', 'r1o', 'r2', 'r2o'].forEach((n) => at(E[n], { transform: t }));
    }
  },
  {
    name: '剪贴板',
    accent: '#16A34A',
    // A clipboard; a check gets ticked on its sheet on hover.
    svg: (u) => {
      const board = rr(6.3, 2.6, 18.4, 21.2, KR), clip = rp(R(11, 0.8, 9, 4.6), [1.6, 1.6, 1.2, 1.2]);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${board}" fill="${u.loS}"/></g></g><path d="${board}" ${OL}/>
        <path d="${rr(8.6, 6.6, 13.8, 15, CR)}" fill="#fff"/>
        <path d="${lines(11, 10.2, [9])}" ${LINE}/>
        <path data-n="chk" d="M12.2 16.2L14.6 18.6L19 14" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${DEEPS}/>
        <g filter="${u.hi}"><path d="${clip}" fill="${u.upS}"/></g><path d="${clip}" ${OL}/>`;
    },
    target: (h) => ({ chk: h ? 1 : 0 }),
    draw(p, E) {
      const L = 9.8;
      at(E.chk, { 'stroke-dasharray': L, 'stroke-dashoffset': f(L * (1 - Math.max(0, Math.min(1, p.chk)))) });
    }
  },
  {
    name: '灯泡',
    accent: '#EC4899',
    // A bulb that lights up on hover.
    svg: (u) => {
      const glass = 'M11 15.6C8.8 14 7.4 11.6 7.4 9A8.1 8.1 0 0 1 23.6 9C23.6 11.6 22.2 14 20 15.6V17.6H11Z';
      const base = rr(10.8, 16.8, 9.4, 6.4, 2);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${glass}" fill="${u.upS}"/></g></g><path d="${glass}" ${OL}/>
        <circle data-n="glow" cx="15.5" cy="9.4" r="5" fill="#fff"/>
        <path d="M12.8 12.6L14.2 9.8L15.5 11.8L16.8 9.8L18.2 12.6" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${DEEPS}/>
        <g filter="${u.hi}"><path d="${base}" fill="${u.loS}"/></g><path d="${base}" ${OL}/>
        <path d="${lines(12.8, 20, [5.4])}" class="ln" stroke="#fff" data-w="stroke"/>`;
    },
    target: (h) => ({ glow: h ? 0.85 : 0 }),
    draw(p, E) { at(E.glow, { opacity: f(p.glow) }); }
  },
  {
    name: '文档',
    accent: '#14B8A6',
    // A page whose folded corner opens a little more on hover.
    svg: (u) => `<g filter="${u.sh}"><g filter="${u.hi}"><path data-n="pg" fill="${u.loS}"/></g></g><path data-n="pgO" ${OL}/>
      <path d="${lines(9.6, 13.4, [11.8, 8.2])}" class="ln" stroke="#fff" data-w="stroke"/>
      <g filter="${u.hi}"><path data-n="fold" fill="${u.upS}"/></g><path data-n="foldO" ${OL}/>`,
    target: (h) => ({ fold: h ? 8 : 6 }),
    draw(p, E) {
      const c = p.fold;
      const pg = rp([[6.3, 1.5], [24.7 - c, 1.5], [24.7, 1.5 + c], [24.7, 23.5], [6.3, 23.5]], [KR, 0.5, 0.5, KR, KR]);
      const fold = rp([[24.7 - c, 1.5], [24.7, 1.5 + c], [24.7 - c, 1.5 + c]], [0.4, 0.4, 1.2]);
      at(E.pg, { d: pg }); at(E.pgO, { d: pg }); at(E.fold, { d: fold }); at(E.foldO, { d: fold });
    }
  },
  {
    name: '包裹',
    accent: '#0284C7',
    // A parcel whose two top flaps fold open on hover.
    svg: (u) => {
      const box = rr(5.2, 8.6, 20.6, 14.2, KR);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${box}" fill="${u.lo(14.2)}"/></g></g><path d="${box}" ${OL}/>
        <path d="${rr(14.2, 8.6, 2.6, 4.6, 0.6)}" fill="#fff"/>
        <g filter="${u.hi}"><path data-n="fl" fill="${u.upS}"/></g><path data-n="flO" ${OL}/>
        <g filter="${u.hi}"><path data-n="fr" fill="${u.upS}"/></g><path data-n="frO" ${OL}/>`;
    },
    target: (h) => ({ o: h ? 1 : 0 }),
    draw(p, E) {
      const o = Math.max(0, Math.min(1, p.o));
      const l = rp([[5.2, 8.6], [15.4, 8.6], [15.4 - 2.6 * o, 6.2 - 2.8 * o], [5.2 - 2.8 * o, 6.2 - 1.6 * o]], [0.6, 0.6, 1, 1]);
      const r = rp([[15.6, 8.6], [25.8, 8.6], [25.8 + 2.8 * o, 6.2 - 1.6 * o], [15.6 + 2.6 * o, 6.2 - 2.8 * o]], [0.6, 0.6, 1, 1]);
      at(E.fl, { d: l }); at(E.flO, { d: l }); at(E.fr, { d: r }); at(E.frO, { d: r });
    }
  },
  {
    name: '钱包',
    accent: '#0EA5E9',
    // A wallet; the card tucked in it rises on hover.
    svg: (u) => {
      const body = rr(4, 5.6, 23, 16.1, KR), pocket = rp(R(4, 11, 23, 10.7), [1.6, 1.6, KR, KR]), card = rr(0, 0, 15, 9, 1.4);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${body}" fill="${u.loS}"/></g></g><path d="${body}" ${OL}/>
        <g data-n="card"><g filter="${u.hi}"><path d="${card}" fill="${u.upS}"/></g><path d="${card}" ${OL}/><path d="${lines(2.2, 2.6, [5.6])}" class="ln" ${DEEPS}/></g>
        <g filter="${u.hi}"><path d="${pocket}" fill="${u.up(10.7)}"/></g><path d="${pocket}" ${OL}/>
        <path d="${rr(19.4, 13.6, 7.6, 4.8, 2.4)}" fill="${u.loS}"/><path d="${rr(19.4, 13.6, 7.6, 4.8, 2.4)}" ${OL}/>`;
    },
    target: (h) => ({ y: h ? 2.4 : 4.6 }),
    draw(p, E) { at(E.card, { transform: `translate(6.6 ${f(p.y)})` }); }
  },
  {
    name: '旗帜',
    accent: '#7C3AED',
    // A flag that ripples on hover.
    svg: (u) => `<path d="M8.2 2.4V23.6" fill="none" stroke-width="2.2" stroke-linecap="round" ${DEEPS}/>
      <g filter="${u.sh}"><g filter="${u.hi}"><path data-n="cl" fill="${u.loS}"/></g></g><path data-n="clO" ${OL}/>`,
    target: (h) => ({ a: h ? -2 : 2 }),
    draw(p, E) {
      const a = p.a;
      const d = `M9.2 3.4C13.6 ${f(3.4 - a)} 18 ${f(3.4 + a)} 25 3.4V15.2C18 ${f(15.2 + a)} 13.6 ${f(15.2 - a)} 9.2 15.2Z`;
      at(E.cl, { d }); at(E.clO, { d });
    }
  },
  {
    name: '书本',
    accent: '#64748B',
    // A closed book whose cover swings open on hover.
    svg: (u) => {
      const back = rr(6.3, 1.5, 18.4, 22, KR), cover = rr(6.3, 1.5, 18.4, 19.4, KR);
      return `<g filter="${u.sh}"><path d="${back}" fill="${u.loS}"/></g><path d="${back}" ${OL}/>
        <path d="${rr(7.8, 3, 15.6, 19.4, CR)}" fill="#fff"/>
        <path d="${lines(11.4, 8.4, [9.2, 6.6])}" ${ACC}/>
        <g data-n="cv"><g filter="${u.hi}"><path d="${cover}" fill="${u.loS}"/></g><path data-n="sh" d="${cover}" ${DEEP} opacity="0"/><path d="${cover}" ${OL}/>
          <path d="${lines(10.4, 7.6, [10.2])}" class="ln" stroke="#fff" data-w="stroke"/></g>`;
    },
    target: (h) => ({ o: h ? 1 : 0 }),
    draw(p, E) {
      const o = Math.max(0, Math.min(1, p.o));
      at(E.cv, { transform: `translate(6.3 0) scale(${f(Math.max(0.001, 1 - 0.72 * o))} 1) translate(-6.3 0)` });
      at(E.sh, { opacity: f(0.35 * o) });
    }
  },
  {
    name: '闹钟',
    accent: '#5393FF',
    // An alarm clock with twin bells on two feet. On hover it rings: it rocks on its feet,
    // the swings die away and it comes to rest upright again.
    svg: (u) => {
      const body = circ(15.5, 13.4, 9.8), bells = circ(8.7, 6.6, 4.2) + circ(22.3, 6.6, 4.2);
      return `
      <g data-n="r0"><path d="M11.2 20.4L8.4 23.4M19.8 20.4L22.6 23.4" fill="none" stroke-width="2.2" stroke-linecap="round" ${DEEPS}/></g>
      <g filter="${u.sh}"><g filter="${u.hi}"><g data-n="r1"><path d="${bells}" fill="${u.upS}"/></g></g></g>
      <g data-n="r2"><path d="${bells}" ${OL}/></g>
      <g filter="${u.sh}"><g filter="${u.hi}"><g data-n="r3"><path d="${body}" fill="${u.loS}"/></g></g></g>
      <g data-n="r4"><path d="${body}" ${OL}/>
        <path d="${circ(15.5, 13.4, 7.4)}" fill="#fff"/>
        <path d="M15.5 13.4V9.6" transform="rotate(${CLOCK_MINUTES / 2} 15.5 13.4)" stroke-width="2.6" stroke-linecap="round" data-t="stroke:#89B5FF"/>
        <path d="M15.5 13.4V7.8" transform="rotate(${(CLOCK_MINUTES * 6) % 360} 15.5 13.4)" stroke-width="2" stroke-linecap="round" ${DEEPS}/>
        <circle cx="15.5" cy="13.4" r="1.7" ${DEEP}/></g>`;
    },
    target: (h) => ({ o: h ? 1 : 0 }),
    draw(p, E) {
      // One 0→1 progress drives a damped rattle that starts and ends upright.
      const o = Math.max(0, Math.min(1, p.o));
      const a = 12 * (1 - o) * Math.sin(5 * Math.PI * o);
      const t = `rotate(${f(a)} 15.5 23.4)`;
      ['r0', 'r1', 'r2', 'r3', 'r4'].forEach((n) => at(E[n], { transform: t }));
    }
  },
  {
    name: '退出',
    accent: '#F97316',
    // A door with an arrow beside it. On hover the door swings open on its left hinge to
    // the bright outside and the arrow heads on out.
    svg: (u) => {
      const frame = rr(4, 1, 12.2, 23, KR), way = rp(R(7, 4, 6.2, 20), [1.6, 1.6, 0, 0]);
      return `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${frame}" fill="${u.loS}"/></g></g>
      <path d="${frame}" ${OL}/>
      <path d="${way}" fill="#fff"/>
      <g filter="${u.hi}"><path data-n="leaf" fill="${u.upS}"/></g>
      <path data-n="leafO" ${OL}/>
      <circle data-n="knob" cy="14" r="1.2" ${DEEP}/>
      <g data-n="arrow"><path d="M20.3 12.5H24" fill="none" stroke-width="2.2" stroke-linecap="round" ${DEEPS}/>
        <path d="${rp([[23.6, 9.9], [27, 12.5], [23.6, 15.1]], 0.5)}" ${DEEP}/></g>`;
    },
    target: (h) => ({ s: h ? 0.5 : 1, x: h ? 1.4 : 0 }),
    draw(p, E) {
      const w = 6.2 * p.s, d = rp(R(7, 4, w, 20), [1.6, 1.6, 0, 0]);
      at(E.leaf, { d }); at(E.leafO, { d });
      // The knob keeps to the free edge and never leaves the narrowing leaf.
      at(E.knob, { cx: f(7 + w * (0.29 + 0.42 * p.s)) });
      at(E.arrow, { transform: `translate(${f(p.x)} 0)` });
    }
  }
];
