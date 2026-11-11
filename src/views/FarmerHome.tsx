import React, { useState, useEffect } from 'react';
import { CaseItem, CaseStatus, OutbreakAlert, FarmerNotification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CaseCard } from '../components/CaseCard';
import { OutbreakBanner } from '../components/OutbreakBanner';
import { CaseChat } from '../components/CaseChat';
import { RatingModal } from '../components/RatingModal';
import { ReportCaseFlow } from '../components/ReportCaseFlow';
import { CasePhotosViewer } from '../components/CasePhotosViewer';
import { formatDateKE } from '../utils/formatters';
import {
  PlusCircle,
  Sprout,
  X,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Edit,
  Stethoscope,
  BookOpen,
} from 'lucide-react';

interface FarmerHomeProps {
  alerts: OutbreakAlert[];
  isCreatingNewCase?: boolean;
  initialCrop?: string;
  initialSymptoms?: string;
  onDoneCreatingCase?: () => void;
  onOpenReport?: (crop?: string, symptoms?: string) => void;
  onNavigateLibrary?: () => void;
}

export const FarmerHome: React.FC<FarmerHomeProps> = ({
  alerts,
  isCreatingNewCase = false,
  initialCrop,
  initialSymptoms,
  onDoneCreatingCase,
  onOpenReport,
  onNavigateLibrary,
}) => {
  const { currentUser, profile } = useAuth();
  const { t, language } = useLanguage();

  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('All');
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(isCreatingNewCase);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [notifications, setNotifications] = useState<FarmerNotification[]>([]);

  useEffect(() => {
    if (isCreatingNewCase) {
      setShowCreateModal(true);
    }
  }, [isCreatingNewCase]);

  // Fetch farmer notifications from Firestore
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const notifsRef = collection(db, 'notifications');
    const q = query(notifsRef, where('userId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: FarmerNotification[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as FarmerNotification);
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(list);
      },
      (error) => {
        console.warn('Notifications listener note:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch farmer cases from Firestore
  useEffect(() => {
    if (!currentUser) {
      setCases([]);
      setLoadingCases(false);
      return;
    }

    const casesRef = collection(db, 'cases');
    const q = query(casesRef, where('farmerId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CaseItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as CaseItem;
          if (!data.deleted) list.push(data);
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCases(list);
        setLoadingCases(false);

        if (selectedCase) {
          const updated = list.find((c) => c.id === selectedCase.id);
          if (updated) setSelectedCase(updated);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cases');
        setLoadingCases(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, selectedCase?.id]);

  const filteredCases = cases.filter((c) => {
    if (activeStatusFilter === 'All') return true;
    return c.status === activeStatusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Outbreak Advisory Banner for Machakos Sub-Counties */}
      <OutbreakBanner
        alerts={alerts}
        userSubCounty={profile?.subCounty}
        onOpenReport={() => setShowCreateModal(true)}
        onNavigateLibrary={onNavigateLibrary}
      />

      {/* Farmer Notifications: Crop Corrections */}
      {notifications
        .filter((n) => !n.read && n.type === 'crop_corrected')
        .map((notif) => (
          <div
            key={notif.id}
            className="mb-5 p-4 rounded-3xl bg-amber-50 border border-amber-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
                <Edit className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                    {language === 'sw' ? 'Zao Limesahihishwa' : 'Crop Corrected'}
                  </span>
                  <span className="text-xs text-amber-800">
                    {formatDateKE(notif.createdAt)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-amber-950 mt-1 leading-snug">
                  {notif.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => {
                  const targetCase = cases.find((c) => c.id === notif.caseId);
                  if (targetCase) setSelectedCase(targetCase);
                }}
                className="min-h-[44px] px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <span>{language === 'sw' ? 'Tazama Kesi' : 'View Case'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                  } catch {
                    setNotifications((prev) => prev.filter((p) => p.id !== notif.id));
                  }
                }}
                title="Dismiss"
                className="min-h-[44px] min-w-[44px] p-2 rounded-full text-amber-800 hover:bg-amber-200/60 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

      {/* Main Farmer Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#0F4A2F] tracking-tight">
            {t('navMyCases')}
          </h1>
          <p className="text-xs sm:text-sm text-[#40544B] mt-0.5">
            {language === 'sw'
              ? 'Ripoti ugonjwa upate uchunguzi wa kitaalamu kutoka kwa maafisa kilimo wa Machakos'
              : 'Report crop symptoms to receive rapid diagnoses from verified Machakos extension officers'}
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="min-h-[48px] px-6 py-3 rounded-full bg-[#2BC55B] hover:bg-[#25ad50] text-[#0F4A2F] font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shrink-0"
        >
          <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          <span>{t('heroReportBtn')}</span>
        </button>
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {(['All', 'Submitted', 'Assigned', 'In Review', 'Advice Given', 'Resolved'] as const).map(
          (statusKey) => (
            <button
              key={statusKey}
              onClick={() => setActiveStatusFilter(statusKey)}
              className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeStatusFilter === statusKey
                  ? 'bg-[#0F4A2F] text-white shadow-xs'
                  : 'bg-[#FBFAF5] text-[#2B3A33] border border-[#E7E2D5] hover:bg-[#EAE5D9]'
              }`}
            >
              {statusKey === 'All'
                ? t('filterAll')
                : statusKey === 'Submitted'
                ? t('statusSubmitted')
                : statusKey === 'Assigned'
                ? t('statusAssigned')
                : statusKey === 'In Review'
                ? t('statusInReview')
                : statusKey === 'Advice Given'
                ? t('statusAdviceGiven')
                : t('statusResolved')}
            </button>
          )
        )}
      </div>

      {/* Case List or Empty State */}
      {loadingCases ? (
        <div className="p-12 text-center text-[#52665C]">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0F4A2F] mb-2" />
          <p className="text-sm font-medium">{t('loading')}</p>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="bg-[#FBFAF5] rounded-3xl border border-[#E7E2D5] p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[#EAE5D9] text-[#0F4A2F] flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-8 h-8 text-[#2BC55B]" />
          </div>
          <h3 className="font-heading font-black text-base text-[#0F4A2F] mb-1">
            {language === 'sw' ? 'Hakuna Kesi Zilizopatikana' : 'No cases yet'}
          </h3>
          <p className="text-xs sm:text-sm text-[#52665C] mb-6 leading-relaxed">
            {t('noCasesFarmer')}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white font-bold text-xs shadow-sm inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4 text-[#2BC55B]" />
            <span>{t('submitCaseTitle')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCases.map((item) => (
            <CaseCard key={item.id} caseItem={item} onOpen={(c) => setSelectedCase(c)} />
          ))}
        </div>
      )}

      {/* Case Consultation Details Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FBFAF5] rounded-3xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl border border-[#E7E2D5] my-6 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E2D5] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCase(null)}
                  className="min-h-[40px] min-w-[40px] p-1.5 rounded-full hover:bg-[#EAE5D9] text-[#2B3A33] sm:hidden flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#0F4A2F] bg-[#EAE5D9] px-2.5 py-0.5 rounded-full">
                      <Sprout className="w-3.5 h-3.5 text-[#2BC55B]" />
                      <span>{selectedCase.crop}</span>
                    </span>
                    <span className="text-xs font-mono text-[#52665C]">
                      ID: {selectedCase.id.slice(0, 10)}
                    </span>
                  </div>
                  <h3 className="font-heading font-black text-xl text-[#0F4A2F] mt-1">
                    {t('caseDetailsTitle')}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#52665C] hover:bg-[#EAE5D9] hover:text-[#0F4A2F]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {/* Status & Officer summary */}
              <div className="p-4 rounded-2xl bg-white border border-[#E7E2D5] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[#687C73] font-medium block">
                    {language === 'sw' ? 'Hali ya Sasa' : 'Current Status'}:
                  </span>
                  <span className="font-bold text-sm text-[#0F4A2F]">{selectedCase.status}</span>
                </div>
                <div>
                  <span className="text-[#687C73] font-medium block">
                    {language === 'sw' ? 'Tarehe ya Kwanza Kuona' : 'Date First Noticed'}:
                  </span>
                  <span className="font-semibold text-[#2B3A33]">{formatDateKE(selectedCase.dateFirstNoticed)}</span>
                </div>
                <div>
                  <span className="text-[#687C73] font-medium block">
                    {language === 'sw' ? 'Afisa Kilimo' : 'Assigned Officer'}:
                  </span>
                  <span className="font-semibold text-[#2B3A33]">
                    {selectedCase.assignedOfficerName || (
                      <span className="text-amber-800 italic">{t('unassignedNotice')}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Photos Gallery (Loaded lazily from subcollection cases/{caseId}/photos) */}
              <CasePhotosViewer
                caseId={selectedCase.id}
                fallbackUrls={selectedCase.photoUrls}
                photoCount={selectedCase.photoCount}
                slotNames={selectedCase.slotNames}
                title={language === 'sw' ? 'Picha za Mmea Ulioathirika' : 'Crop Symptom Photos'}
              />

              {/* Symptoms Description */}
              <div>
                <h4 className="font-heading font-black text-xs uppercase tracking-wider text-[#0F4A2F] mb-1">
                  {t('symptomsLabel')}
                </h4>
                <p className="text-xs sm:text-sm text-[#2B3A33] bg-white p-4 rounded-2xl border border-[#E7E2D5] leading-relaxed whitespace-pre-wrap">
                  {selectedCase.symptomsDescription}
                </p>
              </div>

              {/* Diagnosis & Prescription Card if provided */}
              {selectedCase.diagnosis ? (
                <div className="p-5 rounded-2xl bg-[#DCFCE7]/60 border border-[#86EFAC] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-black text-sm text-[#0F4A2F] flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-[#2BC55B]" />
                      <span>{t('diagnosisTitle')}</span>
                    </h4>
                    <span className="text-xs text-[#166534] font-medium">
                      {formatDateKE(selectedCase.diagnosis.diagnosedAt)}
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-[#86EFAC]/60 shadow-2xs space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#166534]">
                      {t('identifiedDisease')}
                    </p>
                    <p className="font-heading font-black text-base text-[#0F4A2F]">
                      {selectedCase.diagnosis.diseaseName}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-[#86EFAC]/60 shadow-2xs space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#166534]">
                      {t('treatmentAdvice')}
                    </p>
                    <p className="text-xs sm:text-sm text-[#2B3A33] whitespace-pre-wrap leading-relaxed">
                      {selectedCase.diagnosis.treatmentAdvice}
                    </p>
                  </div>

                  {selectedCase.diagnosis.preventionTips && (
                    <div className="bg-white p-4 rounded-xl border border-[#86EFAC]/60 shadow-2xs space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#166534]">
                        {t('preventionTips')}
                      </p>
                      <p className="text-xs sm:text-sm text-[#2B3A33] whitespace-pre-wrap leading-relaxed">
                        {selectedCase.diagnosis.preventionTips}
                      </p>
                    </div>
                  )}

                  {/* Rating Section for Resolved Cases */}
                  {selectedCase.status === 'Resolved' && (
                    <div className="pt-3 border-t border-[#86EFAC]/60 flex items-center justify-between">
                      <div>
                        {selectedCase.rating ? (
                          <div className="flex items-center gap-1 text-sm font-bold text-amber-800">
                            <span>{language === 'sw' ? 'Tathmini Yako:' : 'Your Rating:'}</span>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-4 h-4 ${
                                    s <= (selectedCase.rating || 0)
                                      ? 'fill-amber-400 text-amber-500'
                                      : 'text-stone-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs ml-1">({selectedCase.rating}/5)</span>
                          </div>
                        ) : (
                          <p className="text-xs text-[#52665C]">
                            {language === 'sw'
                              ? 'Kesi hii imetatuliwa. Tafadhali tathmini ushauri wa afisa.'
                              : 'This case is resolved. Please rate the officer advice.'}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setShowRatingModal(true)}
                        className="min-h-[44px] px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold shadow-2xs"
                      >
                        {selectedCase.rating
                          ? (language === 'sw' ? 'Badilisha Tathmini' : 'Update Rating')
                          : t('rateCaseTitle')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {language === 'sw'
                      ? 'Afisa kilimo anakagua picha zako. Unaweza kuwasiliana naye kupitia mazungumzo hapa chini.'
                      : 'The extension officer is reviewing your report. You can chat directly with them below.'}
                  </span>
                </div>
              )}

              {/* Consultation Chat Thread */}
              <div>
                <h4 className="font-heading font-black text-xs uppercase tracking-wider text-[#0F4A2F] mb-2">
                  {t('chatTitle')}
                </h4>
                <CaseChat caseId={selectedCase.id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rebuilt 5-Step Report Flow */}
      <ReportCaseFlow
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          if (onDoneCreatingCase) onDoneCreatingCase();
        }}
        onSuccess={(caseId) => {
          setShowCreateModal(false);
          if (onDoneCreatingCase) onDoneCreatingCase();
        }}
        initialCrop={initialCrop}
        initialSymptoms={initialSymptoms}
        alerts={alerts}
      />

      {/* Rating modal */}
      {showRatingModal && selectedCase && (
        <RatingModal
          caseId={selectedCase.id}
          currentRating={selectedCase.rating}
          currentFeedback={selectedCase.ratingFeedback}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            setShowRatingModal(false);
          }}
        />
      )}
    </div>
  );
};
