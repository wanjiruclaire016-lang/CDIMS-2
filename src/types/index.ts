export type UserRole = 'farmer' | 'officer' | 'admin' | 'superadmin' | 'system';
export type OfficerStatus = 'pending' | 'verified' | 'rejected' | 'revoked';
export type CaseStatus = 'Submitted' | 'Assigned' | 'In Review' | 'Advice Given' | 'Resolved';
export type AlertSeverity = 'Critical' | 'Warning' | 'Advisory' | 'High' | 'Moderate';
export type AlertStatus = 'Active' | 'Resolved' | 'Expired';
export type Language = 'en' | 'sw';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  officerStatus?: OfficerStatus;
  officerIdNumber?: string;
  subCounty: string;
  ward?: string;
  preferredLanguage: Language;
  disabled?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CaseDiagnosis {
  diseaseId?: string;
  diseaseName: string;
  treatmentAdvice: string;
  preventionTips: string;
  diagnosedAt: string;
  officerName?: string;
}

export interface CaseItem {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  crop: string;
  symptomsDescription: string;
  dateFirstNoticed: string;
  subCounty: string;
  ward?: string;
  village?: string;
  photoUrls: string[];
  photoCount?: number;
  slotNames?: string[];
  photoSlots?: {
    wholePlant?: string;
    closeUp?: string;
    stemRoots?: string;
    fieldView?: string;
  };
  symptomChips?: string[];
  fieldFraction?: string;
  spreadSpeed?: string;
  rainPastWeek?: string;
  chemicalsUsed?: string;
  cropStage?: string;
  gpsCoords?: { latitude: number; longitude: number };
  status: CaseStatus;
  assignedOfficerId?: string | null;
  assignedOfficerName?: string | null;
  diagnosis?: CaseDiagnosis | null;
  rating?: number | null;
  ratingFeedback?: string;
  escalated?: boolean;
  escalationReason?: string;
  escalatedBy?: string;
  escalatedAt?: string;
  flaggedForReview?: boolean;
  cropCorrectedBy?: string;
  cropCorrectedAt?: string;
  previousCrop?: string;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FarmerNotification {
  id: string;
  userId: string;
  caseId: string;
  title: string;
  message: string;
  type: 'crop_corrected' | 'assignment' | 'status_change' | 'general';
  read: boolean;
  createdAt: string;
  officerName?: string;
  previousCrop?: string;
  newCrop?: string;
}

export interface CaseMessage {
  id: string;
  caseId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  attachments?: string[];
  createdAt: string;
}

export interface DiseaseImage {
  url: string;
  caption?: string;
  part?: string;
  credit?: string;
  license?: string;
}

export interface DiseaseItem {
  slug: string;
  id: string; // for backward compatibility
  crop: string;
  nameEn: string;
  nameSw: string;
  scientificCause: string;
  severity: 'HIGH' | 'MODERATE' | 'LOW' | 'High' | 'Moderate' | 'Advisory';
  affectedParts: string[];
  symptoms: string;
  spread: string;
  treatment: string;
  prevention: string;
  images: DiseaseImage[];
  reviewedBy?: string;
  reviewedAt?: string;

  // Compatibility fields
  name?: string;
  swahiliName?: string;
  scientificName?: string;
  causes?: string;
  referencePhotoUrls?: string[];
  category?: string;
  symptomTags?: string[];
  organicRemedies?: string;
  chemicalControl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OutbreakAlert {
  id: string;
  title: string;
  crop: string;
  diseaseSlug?: string;
  diseaseName: string;
  severity: AlertSeverity;
  status?: AlertStatus;
  subCounty: string; // primary or 'All Machakos'
  subCounties?: string[];
  wards?: string[];
  allMachakos?: boolean;
  summary: string;
  message?: string; // compatibility
  actionItems?: string[];
  avoidItems?: string[];
  officerId: string;
  officerName: string;
  officerPhone?: string;
  validUntil?: string;
  active: boolean;
  acknowledgementCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AlertAcknowledgement {
  id: string;
  alertId: string;
  farmerId: string;
  farmerName?: string;
  farmerPhone?: string;
  subCounty?: string;
  acknowledgedAt: string;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  action: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export interface CaseReportMetrics {
  totalCases: number;
  openCases: number;
  resolvedCases: number;
  casesByCrop: Record<string, number>;
  casesByDisease: Record<string, number>;
  casesBySubCounty: Record<string, number>;
  casesByMonth: Record<string, number>;
  averageResponseTimeHours: number;
  averageRating: number;
  totalRatings: number;
  officerWorkload: Record<string, { officerName: string; count: number; resolvedCount: number }>;
}

export interface CasePhotoDoc {
  id?: string;
  dataUrl: string;
  slot: string;
  size: number;
  createdAt: string;
}
