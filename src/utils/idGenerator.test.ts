import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSecureAutoId, verifyUniqueCaseIds } from './idGenerator';

test('generateSecureAutoId produces 20-character alphanumeric strings', () => {
  const id = generateSecureAutoId();
  assert.equal(typeof id, 'string');
  assert.equal(id.length, 20);
  assert.match(id, /^[A-Za-z0-9]{20}$/);
});

test('generateSecureAutoId generates 10,000 IDs without any duplicates (zero collision guarantee)', () => {
  const count = 10000;
  const ids = new Set<string>();

  for (let i = 0; i < count; i++) {
    const id = generateSecureAutoId();
    assert.equal(ids.has(id), false, `Collision detected on ID generation ${i}: ${id}`);
    ids.add(id);
  }

  assert.equal(ids.size, count);
  assert.equal(verifyUniqueCaseIds(Array.from(ids)), true);
});

test('verifyUniqueCaseIds correctly detects duplicates and verifies uniqueness', () => {
  const uniqueList = ['case-1', 'case-2', 'case-3', 'case-4'];
  assert.equal(verifyUniqueCaseIds(uniqueList), true);

  const duplicateList = ['case-1', 'case-2', 'case-1', 'case-4'];
  assert.equal(verifyUniqueCaseIds(duplicateList), false);

  const emptyList: string[] = [];
  assert.equal(verifyUniqueCaseIds(emptyList), true);

  const singleItem = ['unique-case-id'];
  assert.equal(verifyUniqueCaseIds(singleItem), true);
});
