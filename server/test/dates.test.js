import test from 'node:test';
import assert from 'node:assert/strict';

import { daysUntilDate } from '../lib/dates.js';

test('daysUntilDate returns 0 for today', () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const ymd = `${y}-${m}-${d}`;
  assert.equal(daysUntilDate(ymd), 0);
});

test('daysUntilDate returns positive for future date', () => {
  const today = new Date();
  const future = new Date(today);
  future.setDate(today.getDate() + 3);
  const y = future.getFullYear();
  const m = String(future.getMonth() + 1).padStart(2, '0');
  const d = String(future.getDate()).padStart(2, '0');
  const ymd = `${y}-${m}-${d}`;
  assert.ok(daysUntilDate(ymd) >= 3);
});

