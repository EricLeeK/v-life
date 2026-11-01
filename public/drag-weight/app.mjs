import { columns, tasks, initialColumns, moveCard, isValidBoard } from './board-model.mjs';
import { createDragBody, stepDragBody } from './physics.mjs';

const STORAGE_KEY = 'akash-drag-weight-board-v1';
const boardEl = document.querySelector('#board');
const scroller = document.querySelector('.board-scroll');
const live = document.querySelector('#live');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const taskById = new Map(tasks.map(task => [task.id, task]));
const cardElements = new Map();
const lists = new Map();
let board = loadBoard();
let pending = null;
let drag = null;
let keyboard = null;
let raf = 0;

const glyphs = {
  backlog: '<circle cx="10" cy="10" r="9" fill="currentColor"/><g fill="white"><circle cx="6" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="14" cy="10" r="1"/></g>',
  progress: '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M10 2a8 8 0 0 1 0 16v-8Z" fill="currentColor"/>',
  review: '<circle cx="10" cy="10" r="9" fill="currentColor"/><path d="m6 7 2-2 2 2m-2-2v6m6 2-2 2-2-2m2 2V9" fill="none" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  done: '<circle cx="10" cy="10" r="9" fill="currentColor"/><path d="m6.5 10 2.3 2.3 4.6-4.6" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  Design: '<path d="M10 1.5a8.5 8.5 0 1 0 0 17h1.2c1.8 0 2.2-1.8 1.2-2.9-.9-1-.3-2.6 1-2.6h1.1c2.7 0 4-1.6 4-4C18.5 5 14.7 1.5 10 1.5Z" fill="currentColor"/><g fill="white"><circle cx="5.5" cy="8" r="1.2"/><circle cx="9" cy="5" r="1.2"/><circle cx="13.5" cy="6" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/></g>',
  API: '<g fill="currentColor"><path d="m10 1 3.4 3.4L10 7.8 6.6 4.4ZM10 12.2l3.4 3.4L10 19l-3.4-3.4ZM1 10l3.4-3.4L7.8 10l-3.4 3.4ZM12.2 10l3.4-3.4L19 10l-3.4 3.4Z"/></g>',
  Feature: '<path fill="currentColor" d="M2 2h7v7H2zm0 9h7v7H2zm9 0h7v7h-7zm3.5-10L19 5.5 14.5 10 10 5.5z"/>',
  Bug: '<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m6 3 2 2m6-2-2 2M3 8h3m-3 4h3m8-4h3m-3 4h3M4 16l3-2m9 2-3-2"/><rect x="6" y="5" width="8" height="12" rx="4" fill="currentColor"/></g><path d="M10 8v6" stroke="white" stroke-width="1.2"/>',
  Content: '<rect x="2" y="2" width="16" height="16" rx="2" fill="currentColor"/><path d="M6 6h8M6 10h8M6 14h5" stroke="white" stroke-width="1.4" stroke-linecap="round"/>',
  Chore: '<path d="m8 1 4 0 .7 3 2 .9 2.6-1 2 3.4-2 2.1v2.2l2 2.1-2 3.4-2.6-1-2 .9-.7 3H8l-.7-3-2-.9-2.6 1-2-3.4 2-2.1V9.4l-2-2.1 2-3.4 2.6 1 2-.9Z" fill="currentColor" transform="translate(1 0) scale(.9)"/><circle cx="10" cy="10" r="3.2" fill="white"/>',
};
const icon = (name, className = 'icon') => `<svg class="${className}" viewBox="0 0 20 20" aria-hidden="true">${glyphs[name]}</svg>`;

function loadBoard() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidBoard(saved)) return saved;
  } catch { /* Storage can be unavailable in private browser contexts. */ }
  return initialColumns();
}
function saveBoard() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); } catch { /* The board remains usable without persistence. */ }
}
function announce(message) { live.textContent = message; }

for (const column of columns) {
  const section = document.createElement('section');
  section.className = 'column';
  section.dataset.column = column.id;
  section.setAttribute('aria-labelledby', `heading-${column.id}`);
  section.innerHTML = `<h2 class="column-heading" id="heading-${column.id}">${icon(column.id)}<span>${column.title}</span><span class="column-count">3</span></h2><div class="card-list" role="list" aria-label="${column.title} tasks"></div>`;
  boardEl.append(section);
  lists.set(column.id, section.querySelector('.card-list'));
}
for (const task of tasks) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'task-card';
  card.dataset.id = task.id;
  card.setAttribute('aria-describedby', 'drag-instructions');
  card.setAttribute('aria-roledescription', 'draggable task');
  card.innerHTML = `${task.cover ? `<img class="card-cover" src="./assets/goal-${task.cover}.png" alt="Sprint goal" draggable="false" />` : ''}<span class="card-content"><span class="card-title"><span class="card-title-text">${task.title}</span>${icon('done', 'complete-icon')}</span><span class="card-meta"><span class="card-type ${task.type.toLowerCase()}">${icon(task.type)}${task.type}</span><span class="card-assignment"><span class="card-date">${task.date}</span><span class="avatar">${task.person}</span></span></span></span>`;
  card.addEventListener('pointerdown', event => pointerDown(event, task.id));
  card.addEventListener('keydown', event => keyDown(event, task.id));
  cardElements.set(task.id, card);
}

function render(animate = true) {
  const before = new Map();
  if (animate && !reducedMotion.matches) {
    for (const [id, card] of cardElements) if (id !== drag?.id) before.set(id, card.getBoundingClientRect());
  }
  for (const column of columns) {
    const list = lists.get(column.id);
    for (const id of board[column.id]) {
      if (drag?.id === id) {
        list.append(drag.placeholder);
      } else {
        const card = cardElements.get(id);
        list.append(card);
        card.classList.toggle('is-done', column.id === 'done');
        card.setAttribute('aria-label', `${taskById.get(id).title}, ${column.title}`);
      }
    }
    document.querySelector(`[data-column="${column.id}"] .column-count`).textContent = board[column.id].length;
    document.querySelector(`[data-progress="${column.id}"]`).style.flexGrow = board[column.id].length;
  }
  document.querySelector('#completed').textContent = board.done.length;
  for (const [id, rect] of before) {
    const card = cardElements.get(id);
    card.getAnimations().forEach(animation => animation.cancel());
    const next = card.getBoundingClientRect();
    if (rect.width && (Math.abs(rect.x - next.x) > .5 || Math.abs(rect.y - next.y) > .5)) {
      card.animate([{ transform: `translate(${rect.x - next.x}px, ${rect.y - next.y}px)` }, { transform: 'translate(0, 0)' }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }
}

function pointerDown(event, id) {
  if (event.button !== 0 || drag || keyboard || pending) return;
  const card = cardElements.get(id);
  pending = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  card.setPointerCapture(event.pointerId);
  card.focus({ preventScroll: true });
}

function beginDrag(event) {
  const card = cardElements.get(pending.id);
  card.getAnimations().forEach(animation => animation.cancel());
  const rect = card.getBoundingClientRect();
  const placeholder = document.createElement('div');
  placeholder.className = 'placeholder';
  placeholder.style.height = `${rect.height}px`;
  placeholder.setAttribute('aria-hidden', 'true');
  card.before(placeholder);
  drag = {
    ...pending, initialBoard: structuredClone(board), card, placeholder,
    offsetX: pending.x - rect.x, offsetY: pending.y - rect.y,
    pointerX: event.clientX, pointerY: event.clientY,
    body: createDragBody(rect.x, rect.y), width: rect.width, height: rect.height,
    lastTime: performance.now(), phase: 'dragging', started: performance.now(),
  };
  pending = null;
  card.style.width = `${rect.width}px`;
  card.style.height = `${rect.height}px`;
  card.classList.add('floating');
  document.body.append(card);
  card.setPointerCapture(drag.pointerId);
  card.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
  document.body.classList.add('is-dragging');
  announce(`Picked up ${taskById.get(drag.id).title}.`);
  raf = requestAnimationFrame(tick);
}

function updateDropTarget() {
  const x = drag.pointerX;
  const y = drag.pointerY;
  const scrollRect = scroller.getBoundingClientRect();
  if (x < scrollRect.left - 40 || x > scrollRect.right + 40 || y < scrollRect.top - 70 || y > scrollRect.bottom + 70) return;
  let closest = null;
  let distance = Infinity;
  for (const column of columns) {
    const rect = lists.get(column.id).getBoundingClientRect();
    const d = Math.abs(x - (rect.left + rect.width / 2));
    if (d < distance) { distance = d; closest = column.id; }
  }
  const currentColumn = columns.find(c => board[c.id].includes(drag.id)).id;
  const placeholderRect = drag.placeholder.getBoundingClientRect();
  if (currentColumn === closest && y >= placeholderRect.top - 8 && y <= placeholderRect.bottom + 8) {
    highlight(closest);
    return;
  }
  const ids = board[closest].filter(id => id !== drag.id);
  let index = ids.findIndex(id => {
    const card = cardElements.get(id);
    // Layout coordinates avoid collision jitter while the FLIP visual is still moving.
    const listRect = lists.get(closest).getBoundingClientRect();
    return y < listRect.top + card.offsetTop - lists.get(closest).offsetTop + card.offsetHeight / 2;
  });
  if (index < 0) index = ids.length;
  if (currentColumn !== closest || board[closest].indexOf(drag.id) !== index) {
    board = moveCard(board, drag.id, closest, index);
    render();
  }
  highlight(closest);
}
function highlight(column) {
  document.querySelectorAll('.column').forEach(el => el.classList.toggle('is-over', el.dataset.column === column));
}

function tick(now) {
  if (!drag) return;
  const dt = Math.min((now - drag.lastTime) / 1000 || 1 / 60, 1 / 30);
  drag.lastTime = now;
  let targetX, targetY;
  if (drag.phase === 'dragging') {
    if (scroller.scrollWidth > scroller.clientWidth) {
      const rect = scroller.getBoundingClientRect();
      const edge = 52;
      const direction = drag.pointerX < rect.left + edge ? -1 : drag.pointerX > rect.right - edge ? 1 : 0;
      if (direction) scroller.scrollLeft += direction * 560 * dt;
    }
    updateDropTarget();
    targetX = drag.pointerX - drag.offsetX;
    targetY = drag.pointerY - drag.offsetY;
  } else {
    const slot = drag.placeholder.getBoundingClientRect();
    targetX = slot.x;
    targetY = slot.y;
  }
  if (reducedMotion.matches) Object.assign(drag.body, { x: targetX, y: targetY, angle: 0, vx: 0, vy: 0 });
  else stepDragBody(drag.body, targetX, targetY, dt, drag.phase === 'dragging');
  const { x, y, angle } = drag.body;
  const lift = drag.phase === 'dragging' && !reducedMotion.matches ? 1 + .012 * Math.min((now - drag.started) / 180, 1) : 1;
  drag.card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg) scale(${lift})`;
  if (drag.phase === 'settling' && (reducedMotion.matches || (Math.hypot(x - targetX, y - targetY) < .25 && Math.abs(angle) < .08 && Math.hypot(drag.body.vx, drag.body.vy) < 4) || now - drag.released > 700)) {
    finishDrop();
  } else raf = requestAnimationFrame(tick);
}

function release(cancel = false) {
  pending = null;
  if (!drag || drag.phase !== 'dragging') return;
  if (cancel) { board = drag.initialBoard; render(); }
  else updateDropTarget();
  drag.phase = 'settling';
  drag.released = performance.now();
  drag.cancelled = cancel;
  document.body.classList.remove('is-dragging');
  highlight(null);
  if (drag.card.hasPointerCapture(drag.pointerId)) drag.card.releasePointerCapture(drag.pointerId);
}
function finishDrop() {
  if (!drag) return;
  cancelAnimationFrame(raf);
  const { id, card, placeholder, cancelled } = drag;
  drag = null;
  card.classList.remove('floating');
  card.style.removeProperty('width');
  card.style.removeProperty('height');
  card.style.removeProperty('transform');
  placeholder.replaceWith(card);
  render(false);
  saveBoard();
  card.focus({ preventScroll: true });
  const column = columns.find(c => board[c.id].includes(id));
  announce(cancelled ? 'Move cancelled.' : `${taskById.get(id).title} moved to ${column.title}, position ${board[column.id].indexOf(id) + 1}.`);
}

document.addEventListener('pointermove', event => {
  if (pending && event.pointerId === pending.pointerId && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) >= 4) beginDrag(event);
  if (drag && event.pointerId === drag.pointerId && drag.phase === 'dragging') {
    drag.pointerX = event.clientX;
    drag.pointerY = event.clientY;
    event.preventDefault();
  }
}, { passive: false });
document.addEventListener('pointerup', event => {
  if (drag && event.pointerId === drag.pointerId) {
    const rect = scroller.getBoundingClientRect();
    const outside = event.clientX < rect.left - 40 || event.clientX > rect.right + 40 || event.clientY < rect.top - 70 || event.clientY > rect.bottom + 70;
    release(outside);
  } else if (pending?.pointerId === event.pointerId) pending = null;
});
document.addEventListener('pointercancel', event => {
  if (event.pointerId === drag?.pointerId || event.pointerId === pending?.pointerId) release(true);
});
document.addEventListener('lostpointercapture', event => {
  if (drag?.phase === 'dragging' && drag.card === event.target && !drag.card.hasPointerCapture(drag.pointerId)) release(true);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (drag) { event.preventDefault(); release(true); }
    if (keyboard) endKeyboard(true);
    pending = null;
    document.querySelector('#keyboard-help').hidden = true;
    document.querySelector('#help').setAttribute('aria-expanded', 'false');
  }
});
window.addEventListener('blur', () => { release(true); if (keyboard) endKeyboard(true); });
window.addEventListener('resize', () => { if (drag) { release(true); finishDrop(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && drag) { release(true); finishDrop(); } });

function keyDown(event, id) {
  if (drag) return;
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    if (keyboard) { endKeyboard(false); return; }
    keyboard = { id, initialBoard: structuredClone(board) };
    cardElements.get(id).classList.add('is-keyboard');
    announce(`Picked up ${taskById.get(id).title}. Use arrow keys to move, Space to drop, Escape to cancel.`);
    return;
  }
  if (!keyboard || keyboard.id !== id) return;
  if (event.key === 'Tab') { endKeyboard(false); return; }
  if (!event.key.startsWith('Arrow')) return;
  event.preventDefault();
  const current = columns.findIndex(column => board[column.id].includes(id));
  const currentColumn = columns[current].id;
  let target = current;
  let index = board[currentColumn].indexOf(id);
  if (event.key === 'ArrowLeft') target = Math.max(0, current - 1);
  if (event.key === 'ArrowRight') target = Math.min(columns.length - 1, current + 1);
  if (event.key === 'ArrowUp') index--;
  if (event.key === 'ArrowDown') index++;
  const destination = columns[target];
  board = moveCard(board, id, destination.id, index);
  render();
  const card = cardElements.get(id);
  card.focus({ preventScroll: true });
  card.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest', inline: 'nearest' });
  announce(`${destination.title}, position ${board[destination.id].indexOf(id) + 1}.`);
}
function endKeyboard(cancel) {
  if (!keyboard) return;
  const { id, initialBoard: original } = keyboard;
  if (cancel) board = original;
  keyboard = null;
  cardElements.get(id).classList.remove('is-keyboard');
  render();
  saveBoard();
  cardElements.get(id).focus({ preventScroll: true });
  announce(cancel ? 'Move cancelled.' : `${taskById.get(id).title} dropped.`);
}
document.querySelector('#reset').addEventListener('click', () => {
  if (drag) { release(true); finishDrop(); }
  if (keyboard) endKeyboard(true);
  board = initialColumns();
  render();
  saveBoard();
  announce('Original video layout restored.');
});
document.querySelector('#help').addEventListener('click', event => {
  const help = document.querySelector('#keyboard-help');
  help.hidden = !help.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!help.hidden));
});
render(false);
