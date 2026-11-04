// Original V-Life artwork, rendered with the same geometry and paint as the preview set.
import { rr, rp, f, at } from '../../vendor/kubai/engine.js';

function surface(path, fill, filter) {
  return `<g filter="${filter}"><path d="${path}" fill="${fill}"/></g>
    <path d="${path}" class="ol" fill="none" stroke-width="2" stroke-linejoin="round" data-t="stroke:#5393FF"/>`;
}

const flame = {
  name: '热焰',
  accent: '#EB653F',
  svg(u) {
    const body = 'M14.9 1.2C19.9 4.1 21.3 7.8 20.6 11.5Q23.2 10.1 23.2 6.8C28.1 12.7 26.4 23.7 16.3 24C8.9 24.3 5 19.7 5.7 14.6C6.3 10.4 9.8 8.1 10.1 5.9Q10.8 6.5 11 9.4C14.1 7.3 15.6 4.1 14.9 1.2Z';
    const core = 'M15.1 10.6C18.1 12.7 18.9 15.4 18.2 17.4Q20.2 16.7 21 14.7C23.2 19.2 20.9 23.7 16 24C11.5 24 9.3 20.8 10.5 17.8C11.5 15 15.1 13.5 15.1 10.6Z';
    return `<g data-n="flame">${surface(body, u.loS, u.sh)}
      <g data-n="core">${surface(core, u.upS, u.hi)}</g></g>`;
  },
  target: hover => ({ lean: hover ? -8 : 0, stretch: hover ? 1.06 : 1 }),
  draw(p, E) {
    at(E.flame, { transform: `rotate(${f(p.lean)} 15.5 23.5)` });
    at(E.core, { transform: `translate(16 24) scale(1 ${f(p.stretch)}) translate(-16 -24)` });
  },
};

const carrot = {
  name: '胡萝卜',
  accent: '#D88732',
  svg(u) {
    const leaves = 'M17.8 9.9C16.3 6.7 17.3 2.4 20.1 1.4Q21.6 2.3 21.1 5.8C23.2 2.5 25.5 1.9 27 2.2Q27.4 4.7 23.4 7.4Q26.2 6.8 27.6 8.1C26.1 10.9 21.7 11.7 18.9 11.4Z';
    const root = 'M4.3 23.2C4 22 8.5 10.7 13.6 6.2C16.1 4.1 20.1 5.2 22.2 7.7C24.1 10 24.4 12.4 21.8 14.7C16.6 19.2 5.4 24.7 4.3 23.2Z';
    const facet = 'M4.3 23.2C9 20.6 16.5 15.2 20 11.4Q22.6 8.4 23.2 10.3Q24.2 12.6 21.8 14.7C16.6 19.2 5.4 24.7 4.3 23.2Z';
    return `<g data-n="leaves">${surface(leaves, u.loS, u.sh)}</g>
      ${surface(root, u.loS, u.sh)}<path d="${facet}" fill="${u.upS}"/>
      <path d="M12.6 9.2l3 2.5M8.9 15l2 1.5" fill="none" stroke-linecap="round" stroke-width="1.6" data-t="stroke:#4389FF"/>`;
  },
  target: hover => ({ bend: hover ? 15 : 0 }),
  draw(p, E) { at(E.leaves, { transform: `rotate(${f(p.bend)} 19.5 9)` }); },
};

const scale = {
  name: '体重秤',
  accent: '#38998D',
  svg(u) {
    const base = rr(5.2, 2.2, 20.6, 20.6, 3);
    const platform = rp([[5.2,12.4],[25.8,12.4],[25.8,22.8],[5.2,22.8]], [1.7,1.7,3,3]);
    return `${surface(base, u.loS, u.sh)}
      <path d="M8.3 7.5Q15.5 0.8 22.7 7.5L19.7 11.4H11.3Z" fill="#fff"/>
      <g data-n="needle"><path d="M15.5 5.8L16.7 10.8Q15.5 12.5 14.3 10.8Z" data-t="fill:#2F6FE0"/></g>
      ${surface(platform, u.up(10.4), u.hi)}
      <path d="M10.7 15.8v3.1M20.3 15.8v3.1" fill="none" stroke-width="1.6" stroke-linecap="round" data-t="stroke:#81B0FF"/>`;
  },
  target: hover => ({ angle: hover ? 32 : -24 }),
  draw(p, E) { at(E.needle, { transform: `rotate(${f(p.angle)} 15.5 10.5)` }); },
};

const language = {
  name: '双语字卡',
  accent: '#736AC0',
  svg(u) {
    const back = rr(4, 2.5, 15.8, 16, 1.9);
    const front = rr(12.2, 8.5, 14.8, 14, 1.9);
    return `<g data-n="back">${surface(back, u.loS, u.sh)}
      <path d="M10.8 5.4v1.8M7.2 7.4h7.4M13.2 7.7q-.8 4-5.8 6.6M8.6 9.7q1.4 2.7 5.7 4.5" fill="none" stroke-width="1.5" stroke-linecap="round" data-w="stroke" stroke="#fff"/></g>
      <g data-n="front">${surface(front, u.upS, u.hi)}
      <path d="M16.2 19.2l3-7h.8l3 7M17.6 16.8h4.1" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" data-t="stroke:#2F6FE0"/></g>`;
  },
  target: hover => ({ spread: hover ? 1 : 0 }),
  draw(p, E) {
    at(E.back, { transform: `rotate(${f(-12 * p.spread)} 15.5 18)` });
    at(E.front, { transform: `rotate(${f(7 * p.spread)} 15.5 18)` });
  },
};

export const productIcons = [flame, carrot, scale, language];
