'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeOrAppendEntry } = require('../lib/merge.js');

// Helper: build an entry with sensible defaults; override fields per test.
function entry(over) {
  return Object.assign(
    {
      id: 1,
      productName: 'Clex Eukatol',
      expiryDate: '06/2027',
      lotNumber: 'ABC123',
      quantity: 5,
      unit: 'Bags',
      stockDate: '2026-04-21',
      notes: '',
      addedAt: '2026-04-21T10:00:00.000Z',
    },
    over || {}
  );
}

test('empty list: appends candidate as new entry at top', () => {
  const cand = entry({ id: 2, quantity: 3 });
  const r = mergeOrAppendEntry([], cand);
  assert.equal(r.action.type, 'new');
  assert.equal(r.action.id, 2);
  assert.deepEqual(r.entries, [cand]);
});

test('no matching entry: appends new (no merge)', () => {
  const existing = entry({ id: 1, lotNumber: 'ABC123', quantity: 5 });
  const cand = entry({ id: 2, lotNumber: 'XYZ999', quantity: 3 });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(r.action.type, 'new');
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[0].id, 2);
  assert.equal(r.entries[1].id, 1);
});

test('exact match on product+lot+unit: merges and sums quantity', () => {
  const existing = entry({
    id: 1,
    quantity: 5,
    addedAt: '2026-04-20T08:00:00.000Z',
  });
  const cand = entry({
    id: 2,
    quantity: 3,
    addedAt: '2026-04-21T10:00:00.000Z',
  });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(r.action.type, 'merge');
  assert.equal(r.action.id, 1, 'merged row keeps original id');
  assert.equal(r.action.prevQuantity, 5);
  assert.equal(r.action.prevAddedAt, '2026-04-20T08:00:00.000Z');
  assert.equal(r.action.prevIndex, 0);
  assert.equal(r.action.addedQuantity, 3);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].id, 1);
  assert.equal(r.entries[0].quantity, 8);
  assert.equal(r.entries[0].addedAt, '2026-04-21T10:00:00.000Z');
});

test('merge floats the row to the top', () => {
  const other = entry({ id: 99, lotNumber: 'OTHER', quantity: 1 });
  const existing = entry({ id: 1, quantity: 5 });
  const cand = entry({ id: 2, quantity: 3 });
  const r = mergeOrAppendEntry([other, existing], cand);
  assert.equal(r.action.type, 'merge');
  assert.equal(r.action.prevIndex, 1);
  assert.equal(r.entries[0].id, 1, 'merged row is now at top');
  assert.equal(r.entries[0].quantity, 8);
  assert.equal(r.entries[1].id, 99);
});

test('case-insensitive product name match', () => {
  const existing = entry({ productName: 'Clex Eukatol', quantity: 5 });
  const cand = entry({ id: 2, productName: 'CLEX EUKATOL', quantity: 2 });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(r.action.type, 'merge');
  assert.equal(r.entries[0].quantity, 7);
  assert.equal(
    r.entries[0].productName,
    'Clex Eukatol',
    'preserves original casing'
  );
});

test('case-insensitive lot number match', () => {
  const existing = entry({ lotNumber: 'abc123', quantity: 5 });
  const cand = entry({ id: 2, lotNumber: 'ABC123', quantity: 2 });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(r.action.type, 'merge');
  assert.equal(r.entries[0].quantity, 7);
  assert.equal(r.entries[0].lotNumber, 'abc123', 'preserves original casing');
});

test('unit mismatch: appends new (no merge)', () => {
  const existing = entry({ unit: 'Bags', quantity: 5 });
  const cand = entry({ id: 2, unit: 'Flowbins', quantity: 2 });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(r.action.type, 'new');
  assert.equal(r.entries.length, 2);
});

test('product mismatch: appends new (no merge)', () => {
  const existing = entry({ productName: 'Clex Eukatol', quantity: 5 });
  const cand = entry({ id: 2, productName: 'Different Product', quantity: 2 });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(r.action.type, 'new');
});

test('lot mismatch: appends new (no merge)', () => {
  const existing = entry({ lotNumber: 'ABC123', quantity: 5 });
  const cand = entry({ id: 2, lotNumber: 'DEF456', quantity: 2 });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(r.action.type, 'new');
});

test('blank lot on candidate: appends new even if existing also blank', () => {
  const existing = entry({ lotNumber: '', quantity: 5 });
  const cand = entry({ id: 2, lotNumber: '', quantity: 2 });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(
    r.action.type,
    'new',
    'blank lot must never merge — would merge unrelated pallets'
  );
  assert.equal(r.entries.length, 2);
});

test('merged row preserves existing expiry, notes, stockDate', () => {
  const existing = entry({
    quantity: 5,
    expiryDate: '06/2027',
    notes: 'aisle 3',
    stockDate: '2026-04-10',
  });
  const cand = entry({
    id: 2,
    quantity: 2,
    expiryDate: '12/2099',
    notes: 'new notes',
    stockDate: '2026-04-21',
  });
  const r = mergeOrAppendEntry([existing], cand);
  assert.equal(r.action.type, 'merge');
  assert.equal(r.entries[0].expiryDate, '06/2027');
  assert.equal(r.entries[0].notes, 'aisle 3');
  assert.equal(r.entries[0].stockDate, '2026-04-10');
});

test('does not mutate input entries array or its items', () => {
  const existing = entry({ id: 1, quantity: 5 });
  const input = [existing];
  const inputSnapshot = JSON.parse(JSON.stringify(input));
  const cand = entry({ id: 2, quantity: 3 });
  const r = mergeOrAppendEntry(input, cand);
  assert.deepEqual(input, inputSnapshot, 'input array unchanged');
  assert.notEqual(r.entries, input, 'returns a new array');
});
