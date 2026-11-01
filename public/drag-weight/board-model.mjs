export const columns = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'progress', title: 'In progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

export const tasks = [
  { id: 'empty', title: 'Empty state for search', type: 'Design', date: 'Nov 4', person: 'LT' },
  { id: 'retry', title: 'Retry sync after rate limit', type: 'API', date: 'Nov 6', person: 'MR' },
  { id: 'export', title: 'Export bookings to CSV', type: 'Feature', date: 'Nov 7', person: 'AK' },
  { id: 'settings', title: 'Settings page layout', type: 'Design', date: 'Nov 3', person: 'JS' },
  { id: 'dark', title: 'Dark mode tokens', type: 'Design', date: 'Nov 7', person: 'JS' },
  { id: 'webhook', title: 'Verify webhook signatures', type: 'API', date: 'Nov 2', person: 'MR', cover: 'purple' },
  { id: 'onboarding', title: 'Onboarding checklist', type: 'Feature', date: 'Nov 2', person: 'AK', cover: 'blue' },
  { id: 'calendar', title: 'Calendar timezone drift', type: 'Bug', date: 'Oct 31', person: 'MR' },
  { id: 'invite', title: 'Invite flow copy', type: 'Content', date: 'Nov 1', person: 'LT' },
  { id: 'billing', title: 'Billing page skeletons', type: 'Design', date: 'Oct 29', person: 'JS', cover: 'green' },
  { id: 'react', title: 'Upgrade to React 19', type: 'Chore', date: 'Oct 28', person: 'AK' },
  { id: 'ranking', title: 'Search ranking tweak', type: 'Feature', date: 'Oct 30', person: 'LT' },
];

export function initialColumns() {
  return { backlog: ['empty', 'retry', 'export'], progress: ['settings', 'dark', 'webhook'], review: ['onboarding', 'calendar', 'invite'], done: ['billing', 'react', 'ranking'] };
}

export function moveCard(board, id, column, index) {
  if (!columns.some(c => c.id === column) || !Object.values(board).some(ids => ids.includes(id))) return board;
  const next = Object.fromEntries(columns.map(c => [c.id, board[c.id].filter(item => item !== id)]));
  next[column].splice(Math.max(0, Math.min(index, next[column].length)), 0, id);
  return next;
}

export function isValidBoard(board) {
  if (!board || columns.some(c => !Array.isArray(board[c.id]))) return false;
  const ids = columns.flatMap(c => board[c.id]);
  return ids.length === tasks.length && new Set(ids).size === tasks.length && tasks.every(t => ids.includes(t.id));
}
