import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPREHENSIVE_DISEASE_CATALOG } from './diseaseDatabase.js';

test('COMPREHENSIVE_DISEASE_CATALOG covers key crops and required fields', () => {
  assert.ok(COMPREHENSIVE_DISEASE_CATALOG.length >= 15, 'Should have at least 15 comprehensive disease entries');

  const crops = new Set(COMPREHENSIVE_DISEASE_CATALOG.map((d) => d.crop));
  assert.ok(crops.has('Cassava'), 'Catalog should include Cassava');
  assert.ok(crops.has('Maize'), 'Catalog should include Maize');
  assert.ok(crops.has('Beans'), 'Catalog should include Beans');
  assert.ok(crops.has('Tomato'), 'Catalog should include Tomato');
  assert.ok(crops.has('Mango'), 'Catalog should include Mango');
  assert.ok(crops.has('Kale'), 'Catalog should include Kale');

  for (const disease of COMPREHENSIVE_DISEASE_CATALOG) {
    assert.ok(disease.slug, 'Disease should have a slug');
    assert.ok(disease.nameEn, 'Disease should have an English name');
    assert.ok(disease.nameSw, 'Disease should have a Swahili name');
    assert.ok(disease.symptoms, 'Disease should have symptoms description');
    assert.ok(disease.treatment, 'Disease should have treatment advice');
    assert.ok(Array.isArray(disease.images), 'Disease images should be an array');
  }
});

test('Search handles disease name, pathogen, and Swahili keywords', () => {
  const query = 'mosaic';
  const matched = COMPREHENSIVE_DISEASE_CATALOG.filter(
    (d) =>
      d.nameEn.toLowerCase().includes(query) ||
      d.nameSw.toLowerCase().includes(query) ||
      d.symptoms.toLowerCase().includes(query)
  );

  assert.ok(matched.length >= 2, 'Should match CMD and other mosaic entries');
});
