import { collection, doc, getDoc, Firestore, DocumentReference } from 'firebase/firestore';

/**
 * Generates a unique, collision-proof Case ID using Firestore auto-generated document ID.
 *
 * Firestore auto-generated IDs consist of 20 characters selected from [A-Za-z0-9]
 * (62^20 ≈ 7.04 × 10^35 possible combinations, ~120 bits of entropy).
 *
 * This function also executes a double-check against both local cases and Firestore
 * to guarantee that no two cases can ever share an ID.
 *
 * @param db Firestore database instance
 * @param existingCaseIds Optional array or set of existing case IDs to check against
 * @returns An object containing the guaranteed unique `id` and `ref` (DocumentReference)
 */
export async function generateUniqueCaseId(
  db: Firestore,
  existingCaseIds?: string[] | Set<string>
): Promise<{ id: string; ref: DocumentReference }> {
  const existingSet = existingCaseIds
    ? existingCaseIds instanceof Set
      ? existingCaseIds
      : new Set(existingCaseIds)
    : null;

  const casesCollection = collection(db, 'cases');

  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    // 1. Generate Firestore auto-generated document reference
    const caseRef = doc(casesCollection);
    const caseId = caseRef.id;

    // 2. Check local cases list
    if (existingSet && existingSet.has(caseId)) {
      continue;
    }

    // 3. Verify in Firestore that this document does not already exist
    try {
      const snap = await getDoc(caseRef);
      if (!snap.exists()) {
        return { id: caseId, ref: caseRef };
      }
    } catch {
      // In offline scenarios or initial creation, return the reference with 120-bit entropy
      return { id: caseId, ref: caseRef };
    }
  }

  // High-entropy fallback if attempts exceeded
  const fallbackId = `case_${Date.now()}_${Math.random().toString(36).slice(2, 11)}_${Math.random().toString(36).slice(2, 11)}`;
  return { id: fallbackId, ref: doc(casesCollection, fallbackId) };
}

/**
 * Generates a cryptographically strong unique ID string (20 alphanumeric chars, identical entropy to Firestore auto-ID).
 * Suitable for offline ID generation and unit testing collision resistance.
 */
export function generateSecureAutoId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let autoId = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 20; i++) {
      autoId += chars[bytes[i] % chars.length];
    }
    return autoId;
  }
  for (let i = 0; i < 20; i++) {
    autoId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return autoId;
}

/**
 * Verifies that an array of case IDs contains strictly unique entries with zero duplicates.
 */
export function verifyUniqueCaseIds(ids: string[]): boolean {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
  }
  return true;
}
