import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUserFirstAdmin,
  isUserSuperAdmin,
  isCaseOverdue24h,
  filterCases,
  calculateCaseMetrics,
  generateCasesCsv,
  escapeCsvField,
} from './caseFilters';
import { CaseItem } from '../types';

test('isUserSuperAdmin correctly identifies wanjiruclaire016@gmail.com as the only Super Admin', () => {
  assert.equal(isUserSuperAdmin('wanjiruclaire016@gmail.com'), true);
  assert.equal(isUserSuperAdmin('WANJIRUCLAIRE016@GMAIL.COM '), true);
  assert.equal(isUserSuperAdmin('admin2@cropcare.co.ke'), false);
  assert.equal(isUserSuperAdmin(null), false);
  assert.equal(isUserSuperAdmin(''), false);
});

test('isCaseOverdue24h flags cases submitted more than 24 hours ago as overdue', () => {
  const baseTime = new Date('2026-10-21T12:00:00Z').getTime();

  // Case created 2 hours ago -> NOT overdue
  const recentCase: CaseItem = {
    id: 'c-recent',
    farmerId: 'f1',
    farmerName: 'Farmer 1',
    farmerPhone: '0711',
    crop: 'Cassava',
    symptomsDescription: 'Symptoms',
    dateFirstNoticed: '2026-10-21',
    subCounty: 'Kangundo',
    photoUrls: [],
    status: 'Submitted',
    createdAt: new Date('2026-10-21T10:00:00Z').toISOString(),
  };
  assert.equal(isCaseOverdue24h(recentCase, baseTime), false);

  // Case created 26 hours ago, unassigned -> OVERDUE
  const overdueCase: CaseItem = {
    id: 'c-overdue',
    farmerId: 'f2',
    farmerName: 'Farmer 2',
    farmerPhone: '0722',
    crop: 'Maize',
    symptomsDescription: 'Symptoms',
    dateFirstNoticed: '2026-10-20',
    subCounty: 'Machakos Town',
    photoUrls: [],
    status: 'Submitted',
    createdAt: new Date('2026-10-20T08:00:00Z').toISOString(),
  };
  assert.equal(isCaseOverdue24h(overdueCase, baseTime), true);

  // Case created 30 hours ago, but already Assigned -> NOT overdue in unassigned SLA
  const assignedCase: CaseItem = {
    ...overdueCase,
    id: 'c-assigned',
    status: 'Assigned',
    assignedOfficerId: 'officer-1',
  };
  assert.equal(isCaseOverdue24h(assignedCase, baseTime), false);
});

test('escapeCsvField correctly handles quotes, nulls, and newlines', () => {
  assert.equal(escapeCsvField(null), '""');
  assert.equal(escapeCsvField('Maize "Field"'), '"Maize ""Field"""');
  assert.equal(escapeCsvField(123), '"123"');
});

test('filterCases correctly filters by crop, subCounty, and search query', () => {
  const sampleCases: CaseItem[] = [
    {
      id: 'case-1',
      farmerId: 'farmer-1',
      farmerName: 'John Musyoka',
      farmerPhone: '+254712345678',
      crop: 'Cassava (Mihogo)',
      symptomsDescription: 'Yellow mosaic patterns on leaves',
      dateFirstNoticed: '2026-10-10',
      subCounty: 'Kangundo',
      ward: 'Kangundo Central',
      photoUrls: [],
      status: 'Submitted',
      createdAt: '2026-10-10T08:00:00Z',
    },
    {
      id: 'case-2',
      farmerId: 'farmer-2',
      farmerName: 'Mary Mutua',
      farmerPhone: '+254722334455',
      crop: 'Maize (Mahindi)',
      symptomsDescription: 'Holes in stems and leaves from caterpillar',
      dateFirstNoticed: '2026-10-12',
      subCounty: 'Machakos Town',
      ward: 'Mutituni',
      photoUrls: [],
      status: 'Assigned',
      assignedOfficerId: 'off-1',
      assignedOfficerName: 'Officer Ndambuki',
      createdAt: '2026-10-12T09:00:00Z',
    },
  ];

  // Test crop filter
  const cassavaFiltered = filterCases(sampleCases, { crop: 'Cassava' });
  assert.equal(cassavaFiltered.length, 1);
  assert.equal(cassavaFiltered[0].id, 'case-1');

  // Test sub-county filter
  const machakosFiltered = filterCases(sampleCases, { subCounty: 'Machakos Town' });
  assert.equal(machakosFiltered.length, 1);
  assert.equal(machakosFiltered[0].id, 'case-2');

  // Test search query
  const queryFiltered = filterCases(sampleCases, { query: 'Musyoka' });
  assert.equal(queryFiltered.length, 1);
  assert.equal(queryFiltered[0].farmerName, 'John Musyoka');
});

test('calculateCaseMetrics computes total, open, resolved, response time, and ratings', () => {
  const cases: CaseItem[] = [
    {
      id: 'c1',
      farmerId: 'f1',
      farmerName: 'Alice',
      farmerPhone: '0711111111',
      crop: 'Cassava',
      symptomsDescription: 'Brown lesions',
      dateFirstNoticed: '2026-10-01',
      subCounty: 'Kathiani',
      photoUrls: [],
      status: 'Resolved',
      assignedOfficerId: 'off-1',
      assignedOfficerName: 'Dr. Kioko',
      diagnosis: {
        diseaseName: 'Cassava Brown Streak Disease',
        treatmentAdvice: 'Harvest early and use clean cuttings',
        preventionTips: 'Crop rotation',
        diagnosedAt: '2026-10-01T12:00:00Z',
      },
      rating: 5,
      createdAt: '2026-10-01T08:00:00Z', // 4 hours response time
    },
    {
      id: 'c2',
      farmerId: 'f2',
      farmerName: 'Bob',
      farmerPhone: '0722222222',
      crop: 'Beans',
      symptomsDescription: 'Rust spots',
      dateFirstNoticed: '2026-10-02',
      subCounty: 'Yatta',
      photoUrls: [],
      status: 'Submitted',
      createdAt: '2026-10-02T10:00:00Z',
    },
  ];

  const metrics = calculateCaseMetrics(cases);
  assert.equal(metrics.totalCases, 2);
  assert.equal(metrics.resolvedCases, 1);
  assert.equal(metrics.openCases, 1);
  assert.equal(metrics.averageResponseTimeHours, 4.0);
  assert.equal(metrics.averageRating, 5.0);
  assert.equal(metrics.totalRatings, 1);
  assert.equal(metrics.casesByCrop['Cassava'], 1);
  assert.equal(metrics.casesByCrop['Beans'], 1);
  assert.equal(metrics.casesBySubCounty['Kathiani'], 1);
});

test('generateCasesCsv formats valid CSV output with header', () => {
  const cases: CaseItem[] = [
    {
      id: 'c1',
      farmerId: 'f1',
      farmerName: 'Jane Wambua',
      farmerPhone: '0733333333',
      crop: 'Cassava',
      symptomsDescription: 'Wilted leaves',
      dateFirstNoticed: '2026-10-05',
      subCounty: 'Mwala',
      photoUrls: [],
      status: 'Submitted',
      createdAt: '2026-10-05T08:00:00Z',
    },
  ];

  const csv = generateCasesCsv(cases);
  assert.ok(csv.includes('Case ID,Date Submitted,Farmer Name'));
  assert.ok(csv.includes('"Jane Wambua"'));
  assert.ok(csv.includes('"Mwala"'));
});

test('SUBMIT_CASE_CROPS contains exactly the specified crop list with placeholder requirements', async () => {
  const { SUBMIT_CASE_CROPS } = await import('./machakosData');
  assert.deepEqual(Array.from(SUBMIT_CASE_CROPS), [
    'Maize (Mahindi)',
    'Cassava (Mihogo)',
    'Beans (Maharagwe)',
    'Tomato (Nyanya)',
    'Sorghum',
    'Kale (Sukuma wiki)',
    'Other',
  ]);
});

test('CaseItem supports crop correction metadata (cropCorrectedBy, cropCorrectedAt, previousCrop)', () => {
  const correctedCase: CaseItem = {
    id: 'case-crop-1',
    farmerId: 'farmer-10',
    farmerName: 'Kilonzo Muli',
    farmerPhone: '0712345678',
    crop: 'Tomato (Nyanya)',
    previousCrop: 'Maize (Mahindi)',
    cropCorrectedBy: 'Officer Faith Mutiso',
    cropCorrectedAt: '2026-10-31T09:00:00.000Z',
    symptomsDescription: 'Leaf blight and spots',
    dateFirstNoticed: '2026-10-30',
    subCounty: 'Kangundo',
    photoUrls: [],
    status: 'Assigned',
    assignedOfficerId: 'officer-mutiso',
    createdAt: '2026-10-30T10:00:00.000Z',
  };

  assert.equal(correctedCase.crop, 'Tomato (Nyanya)');
  assert.equal(correctedCase.previousCrop, 'Maize (Mahindi)');
  assert.equal(correctedCase.cropCorrectedBy, 'Officer Faith Mutiso');
  assert.ok(correctedCase.cropCorrectedAt);
});
