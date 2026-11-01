import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragBody, stepDragBody, MAX_TILT } from '../../public/drag-weight/physics.mjs';
import { initialColumns, moveCard } from '../../public/drag-weight/board-model.mjs';

test('fast movement tilts more than slow movement, independent of screen position', () => {
  function drag(speed, offset = 0) {
    const body = createDragBody(offset, 0);
    for (let i = 1; i <= 30; i++) stepDragBody(body, offset + speed * i / 60, 0, 1 / 60);
    return body.angle;
  }
  assert.ok(Math.abs(drag(1200)) > Math.abs(drag(100)) * 2);
  assert.ok(Math.abs(drag(400, 1000) - drag(400, 0)) < 0.001);
  assert.ok(drag(600) > 0);
  assert.ok(drag(-600) < 0);
});

test('rapid reversal never exceeds the 4.5 degree ceiling', () => {
  const body = createDragBody(0, 0);
  for (let i = 0; i < 600; i++) {
    stepDragBody(body, Math.sin(i / 12) * 2000, 0, 1 / 120);
    assert.ok(Math.abs(body.angle) <= MAX_TILT);
  }
  assert.equal(MAX_TILT, 4.5);
});

test('holding the pointer still returns a displaced card upright', () => {
  const body = createDragBody(0, 0);
  for (let i = 1; i <= 30; i++) stepDragBody(body, i * 20, i * 3, 1 / 60);
  assert.ok(body.angle > 1);
  for (let i = 0; i < 120; i++) stepDragBody(body, 600, 90, 1 / 60);
  assert.ok(Math.abs(body.angle) < 0.01);
  assert.ok(Math.abs(body.x - 600) < 0.01);
  assert.ok(Math.abs(body.y - 90) < 0.01);
});

test('spring converges at both 60 and 120 Hz, including a suspended frame', () => {
  for (const fps of [60, 120]) {
    const body = createDragBody(0, 0);
    stepDragBody(body, 300, 50, 5);
    assert.ok(Number.isFinite(body.x));
    for (let i = 0; i < fps * 2; i++) stepDragBody(body, 300, 50, 1 / fps, false);
    assert.ok(Math.abs(body.x - 300) < 0.01);
    assert.ok(Math.abs(body.y - 50) < 0.01);
    assert.ok(Math.abs(body.angle) < 0.01);
  }
});

test('cross-column and same-column moves retain every card exactly once', () => {
  const seed = initialColumns();
  const moved = moveCard(seed, 'invite', 'done', 3);
  assert.equal(moved.review.length, 2);
  assert.equal(moved.done.at(-1), 'invite');
  assert.equal(seed.review.length, 3);
  const reordered = moveCard(moved, 'invite', 'done', 0);
  assert.equal(reordered.done[0], 'invite');
  assert.equal(new Set(Object.values(reordered).flat()).size, 12);
  assert.equal(Object.values(reordered).flat().length, 12);
});

test('empty columns accept a card and invalid moves preserve the board', () => {
  const seed = initialColumns();
  let board = seed;
  for (const id of seed.backlog) board = moveCard(board, id, 'done', 99);
  assert.equal(board.backlog.length, 0);
  board = moveCard(board, 'invite', 'backlog', 0);
  assert.deepEqual(board.backlog, ['invite']);
  assert.deepEqual(moveCard(board, 'missing', 'done', 0), board);
  assert.deepEqual(moveCard(board, 'invite', 'missing', 0), board);
});
