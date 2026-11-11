import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

/**
 * CONSTANT TO TOGGLE STORAGE BACKEND:
 * Set to `true` to store photos as base64 documents in the Firestore subcollection
 * `cases/{caseId}/photos/{slotName}`.
 * Set to `false` to switch back to Firebase Storage (`cases/{caseId}/{slotName}.jpg`).
 */
export const USE_FIRESTORE_PHOTOS = true;

export interface CasePhotoPayload {
  slot: string;
  dataUrl: string;
  sizeBytes: number;
  file?: File;
}

export interface CasePhotoRecord {
  id: string;
  slot: string;
  dataUrl: string;
  size: number;
  createdAt: string;
}

export interface SavePhotosResult {
  photoCount: number;
  slotNames: string[];
  photoUrls: string[];
}

/**
 * Single unified function to save or upload case photos.
 * Switching back to Firebase Storage requires only changing `USE_FIRESTORE_PHOTOS = false`.
 */
export async function saveCasePhotos(
  caseId: string,
  photos: CasePhotoPayload[]
): Promise<SavePhotosResult> {
  const slotNames = photos.map((p) => p.slot);

  // Save each photo as its own document in cases/{caseId}/photos/{slotName}
  const nowIso = new Date().toISOString();
  for (const photo of photos) {
    const photoDocRef = doc(db, 'cases', caseId, 'photos', photo.slot);
    try {
      await setDoc(photoDocRef, {
        dataUrl: photo.dataUrl,
        slot: photo.slot,
        size: photo.sizeBytes,
        createdAt: nowIso,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `cases/${caseId}/photos/${photo.slot}`);
    }
  }

  return {
    photoCount: photos.length,
    slotNames,
    photoUrls: [], // Empty: photos are kept in subcollection, not in main doc
  };
}

/**
 * Lazily loads case photos from the subcollection `cases/{caseId}/photos`.
 */
export async function fetchCasePhotos(caseId: string): Promise<CasePhotoRecord[]> {
  const photosRef = collection(db, 'cases', caseId, 'photos');
  try {
    const snap = await getDocs(photosRef);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        slot: data.slot || d.id,
        dataUrl: data.dataUrl || '',
        size: data.size || 0,
        createdAt: data.createdAt || '',
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `cases/${caseId}/photos`);
    return [];
  }
}
