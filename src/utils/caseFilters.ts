import { CaseItem, CaseReportMetrics } from '../types';

export const SUPER_ADMIN_EMAIL = 'wanjiruclaire016@gmail.com';
export const FIRST_ADMIN_EMAIL = SUPER_ADMIN_EMAIL;

/**
 * Checks whether the given email matches the designated single Super Admin
 */
export function isUserSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function isUserFirstAdmin(email?: string | null): boolean {
  return isUserSuperAdmin(email);
}

/**
 * Checks if an unassigned case has remained in 'Submitted' state for > 24 hours
 */
export function isCaseOverdue24h(caseItem: CaseItem, nowMs: number = Date.now()): boolean {
  if (caseItem.status !== 'Submitted') return false;
  if (caseItem.assignedOfficerId) return false;
  const createdMs = new Date(caseItem.createdAt).getTime();
  if (isNaN(createdMs)) return false;
  const elapsedMs = nowMs - createdMs;
  return elapsedMs > 24 * 60 * 60 * 1000;
}

/**
 * Pure filter function for case queries
 */
export function filterCases(
  cases: CaseItem[],
  filters: {
    query?: string;
    crop?: string;
    subCounty?: string;
    status?: string;
  }
): CaseItem[] {
  return cases.filter((c) => {
    // Crop filter
    if (filters.crop && filters.crop !== 'All' && filters.crop !== 'Yote') {
      const match = c.crop.toLowerCase().includes(filters.crop.toLowerCase());
      if (!match) return false;
    }

    // Sub-county filter
    if (filters.subCounty && filters.subCounty !== 'All' && filters.subCounty !== 'Yote') {
      if (c.subCounty.toLowerCase() !== filters.subCounty.toLowerCase()) {
        return false;
      }
    }

    // Status filter
    if (filters.status && filters.status !== 'All' && filters.status !== 'Yote') {
      if (c.status !== filters.status) {
        return false;
      }
    }

    // Text search query
    if (filters.query && filters.query.trim()) {
      const q = filters.query.toLowerCase().trim();
      const inFarmer = c.farmerName?.toLowerCase().includes(q);
      const inCrop = c.crop?.toLowerCase().includes(q);
      const inSymptoms = c.symptomsDescription?.toLowerCase().includes(q);
      const inSubCounty = c.subCounty?.toLowerCase().includes(q);
      const inWard = c.ward?.toLowerCase().includes(q);
      const inDisease = c.diagnosis?.diseaseName?.toLowerCase().includes(q);
      const inOfficer = c.assignedOfficerName?.toLowerCase().includes(q);

      if (!inFarmer && !inCrop && !inSymptoms && !inSubCounty && !inWard && !inDisease && !inOfficer) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Aggregates case records into structured metrics for reports and dashboards
 */
export function calculateCaseMetrics(cases: CaseItem[]): CaseReportMetrics {
  const totalCases = cases.length;
  let resolvedCases = 0;
  let openCases = 0;

  const casesByCrop: Record<string, number> = {};
  const casesByDisease: Record<string, number> = {};
  const casesBySubCounty: Record<string, number> = {};
  const casesByMonth: Record<string, number> = {};
  const officerWorkload: Record<string, { officerName: string; count: number; resolvedCount: number }> = {};

  let totalResponseTimeMs = 0;
  let responseTimeCount = 0;
  let sumRatings = 0;
  let totalRatings = 0;

  cases.forEach((item) => {
    // Resolved vs Open
    if (item.status === 'Resolved') {
      resolvedCases++;
    } else {
      openCases++;
    }

    // Crop distribution
    const cropKey = item.crop || 'Unknown';
    casesByCrop[cropKey] = (casesByCrop[cropKey] || 0) + 1;

    // Sub-county distribution
    const locKey = item.subCounty || 'Unspecified';
    casesBySubCounty[locKey] = (casesBySubCounty[locKey] || 0) + 1;

    // Month distribution (YYYY-MM)
    if (item.createdAt) {
      const monthKey = item.createdAt.slice(0, 7);
      casesByMonth[monthKey] = (casesByMonth[monthKey] || 0) + 1;
    }

    // Disease diagnosis distribution
    if (item.diagnosis?.diseaseName) {
      const dName = item.diagnosis.diseaseName;
      casesByDisease[dName] = (casesByDisease[dName] || 0) + 1;

      // Response time: from createdAt to diagnosis.diagnosedAt
      if (item.diagnosis.diagnosedAt && item.createdAt) {
        const createdMs = new Date(item.createdAt).getTime();
        const diagnosedMs = new Date(item.diagnosis.diagnosedAt).getTime();
        if (!isNaN(createdMs) && !isNaN(diagnosedMs) && diagnosedMs >= createdMs) {
          totalResponseTimeMs += diagnosedMs - createdMs;
          responseTimeCount++;
        }
      }
    }

    // Officer workload
    if (item.assignedOfficerId) {
      const offId = item.assignedOfficerId;
      const offName = item.assignedOfficerName || 'Officer';
      if (!officerWorkload[offId]) {
        officerWorkload[offId] = { officerName: offName, count: 0, resolvedCount: 0 };
      }
      officerWorkload[offId].count += 1;
      if (item.status === 'Resolved') {
        officerWorkload[offId].resolvedCount += 1;
      }
    }

    // Farmer ratings
    if (typeof item.rating === 'number' && item.rating >= 1 && item.rating <= 5) {
      sumRatings += item.rating;
      totalRatings++;
    }
  });

  const averageResponseTimeHours =
    responseTimeCount > 0 ? Number((totalResponseTimeMs / (responseTimeCount * 3600 * 1000)).toFixed(1)) : 0;

  const averageRating = totalRatings > 0 ? Number((sumRatings / totalRatings).toFixed(1)) : 0;

  return {
    totalCases,
    openCases,
    resolvedCases,
    casesByCrop,
    casesByDisease,
    casesBySubCounty,
    casesByMonth,
    averageResponseTimeHours,
    averageRating,
    totalRatings,
    officerWorkload,
  };
}

/**
 * Escapes a single CSV field value according to RFC 4180
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates RFC 4180 compliant CSV export for CDIMS cases
 */
export function generateCasesCsv(cases: CaseItem[]): string {
  const headers = [
    'Case ID',
    'Date Submitted',
    'Farmer Name',
    'Farmer Phone',
    'Crop',
    'Sub-County',
    'Ward',
    'Date First Noticed',
    'Status',
    'Assigned Officer',
    'Identified Disease',
    'Treatment Advice',
    'Prevention Tips',
    'Diagnosed Date',
    'Rating (1-5)',
    'Rating Feedback',
  ];

  const rows = cases.map((c) => [
    escapeCsvField(c.id),
    escapeCsvField(c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''),
    escapeCsvField(c.farmerName),
    escapeCsvField(c.farmerPhone),
    escapeCsvField(c.crop),
    escapeCsvField(c.subCounty),
    escapeCsvField(c.ward || ''),
    escapeCsvField(c.dateFirstNoticed),
    escapeCsvField(c.status),
    escapeCsvField(c.assignedOfficerName || 'Unassigned'),
    escapeCsvField(c.diagnosis?.diseaseName || ''),
    escapeCsvField(c.diagnosis?.treatmentAdvice || ''),
    escapeCsvField(c.diagnosis?.preventionTips || ''),
    escapeCsvField(c.diagnosis?.diagnosedAt ? new Date(c.diagnosis.diagnosedAt).toLocaleDateString() : ''),
    escapeCsvField(c.rating || ''),
    escapeCsvField(c.ratingFeedback || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}
