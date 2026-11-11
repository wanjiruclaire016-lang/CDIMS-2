import React, { useState, useEffect } from 'react';
import { CaseItem, OutbreakAlert } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CaseCard } from '../components/CaseCard';
import { CaseChat } from '../components/CaseChat';
import { DiagnosisModal } from '../components/DiagnosisModal';
import { ReassignModal } from '../components/ReassignModal';
import { OutbreakAlertModal } from '../components/OutbreakAlertModal';
import { EditCropModal } from '../components/EditCropModal';
import { CasePhotosViewer } from '../components/CasePhotosViewer';
import { MACHAKOS_SUB_COUNTIES, COMMON_CROPS } from '../utils/machakosData';
import { filterCases, isUserSuperAdmin } from '../utils/caseFilters';
import { formatDateKE } from '../utils/formatters';
import {
  Inbox,
  ClipboardList,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  RefreshCw,
  X,
  Stethoscope,
  Loader2,
  ArrowLeft,
  BellRing,
  Pencil,
  Sprout,
  MapPin,
  Phone,
  Calendar,
} from 'lucide-react';

interface OfficerHomeProps {
  initialTab?: 'queue' | 'assigned';
}

export const OfficerHome: React.FC<OfficerHomeProps> = ({ initialTab = 'queue' }) => {
  const { currentUser, profile, recordAuditLog, isAdminUser, isSuperAdminUser } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'queue' | 'assigned'>(initialTab);
  const [allCases, setAllCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for the unassigned queue
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCrop, setFilterCrop] = useState('All');
  const [filterSubCounty, setFilterSubCounty] = useState('All');

  // Interactive Modals
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showOutbreakModal, setShowOutbreakModal] = useState(false);
  const [showEditCropModal, setShowEditCropModal] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const isPending = profile?.role === 'officer' && profile?.officerStatus !== 'verified';

  // Listen to all relevant cases
  useEffect(() => {
    if (!currentUser || isPending) {
      setLoading(false);
      return;
    }

    const casesCol = collection(db, 'cases');
    const unsubscribe = onSnapshot(
      casesCol,
      (snapshot) => {
        const list: CaseItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as CaseItem;
          if (!data.deleted) list.push(data);
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAllCases(list);
        setLoading(false);

        if (selectedCase) {
          const updated = list.find((c) => c.id === selectedCase.id);
          if (updated) setSelectedCase(updated);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cases');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, isPending, selectedCase?.id]);

  // Claim case handler
  const handleClaimCase = async (caseItem: CaseItem) => {
    if (!currentUser || !profile) return;
    setClaimingId(caseItem.id);
    const nowIso = new Date().toISOString();

    try {
      const caseRef = doc(db, 'cases', caseItem.id);
      await updateDoc(caseRef, {
        assignedOfficerId: currentUser.uid,
        assignedOfficerName: profile.fullName || 'Extension Officer',
        status: 'Assigned',
        updatedAt: nowIso,
      });

      await recordAuditLog(
        'CASE_CLAIMED',
        caseItem.id,
        `Case claimed by officer ${profile.fullName || currentUser.email}`
      );

      const updatedCase: CaseItem = {
        ...caseItem,
        assignedOfficerId: currentUser.uid,
        assignedOfficerName: profile.fullName || 'Extension Officer',
        status: 'Assigned',
      };
      setSelectedCase(updatedCase);
      setActiveTab('assigned');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${caseItem.id}`);
    } finally {
      setClaimingId(null);
    }
  };

  // Pending Officer Screen
  if (isPending) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#FBFAF5] rounded-3xl border border-amber-200 p-8 sm:p-12 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto mb-5 border border-amber-300">
            <Clock className="w-8 h-8 text-amber-800" />
          </div>
          <h2 className="font-heading font-black text-xl sm:text-2xl text-[#0F4A2F] mb-2">
            {t('waitingVerificationTitle')}
          </h2>
          <p className="text-sm text-[#52665C] leading-relaxed max-w-md mx-auto mb-6">
            {t('waitingVerificationMessage')}
          </p>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left text-xs space-y-2 max-w-md mx-auto text-[#2B3A33]">
            <p>
              <strong className="text-[#0F4A2F]">{language === 'sw' ? 'Afisa:' : 'Officer Name:'}</strong>{' '}
              {profile?.fullName}
            </p>
            <p>
              <strong className="text-[#0F4A2F]">Email:</strong> {profile?.email}
            </p>
            <p>
              <strong className="text-[#0F4A2F]">{t('officerIdLabel')}:</strong>{' '}
              {profile?.officerIdNumber || 'Pending'}
            </p>
            <p>
              <strong className="text-[#0F4A2F]">{t('subCountyLabel')}:</strong>{' '}
              {profile?.subCounty}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Unassigned Queue
  const unassignedCases = allCases.filter(
    (c) => c.status === 'Submitted' || !c.assignedOfficerId
  );
  const filteredQueue = filterCases(unassignedCases, {
    query: searchQuery,
    crop: filterCrop,
    subCounty: filterSubCounty,
  });

  // Assigned to me
  const myAssignedCases = allCases.filter(
    (c) => c.assignedOfficerId === currentUser?.uid
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header & Outbreak Alert Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#0F4A2F] tracking-tight">
            {activeTab === 'queue' ? t('officerQueueTitle') : t('navAssignedCases')}
          </h1>
          <p className="text-xs sm:text-sm text-[#40544B] mt-0.5">
            {language === 'sw'
              ? 'Hudumia wakulima wa Machakos kwa uchunguzi na ushauri wa kitaalamu'
              : 'Support Machakos farmers with expert diagnostics, treatments, and containment'}
          </p>
        </div>

        <button
          onClick={() => setShowOutbreakModal(true)}
          className="min-h-[48px] px-5 py-2.5 rounded-full bg-[#DC2626] hover:bg-[#b91c1c] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shrink-0"
        >
          <BellRing className="w-4 h-4" />
          <span>{t('outbreakAlertBtn')}</span>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-[#E7E2D5] pb-3 mb-6">
        <button
          onClick={() => setActiveTab('queue')}
          className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'queue'
              ? 'bg-[#0F4A2F] text-white shadow-sm'
              : 'bg-[#FBFAF5] text-[#2B3A33] border border-[#E7E2D5] hover:bg-[#EAE5D9]'
          }`}
        >
          <Inbox className="w-4 h-4 text-[#2BC55B]" />
          <span>{t('navOfficerQueue')}</span>
          <span className="px-2 py-0.5 rounded-full bg-[#2BC55B] text-[#0F4A2F] text-[10px] font-extrabold">
            {unassignedCases.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('assigned')}
          className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'assigned'
              ? 'bg-[#0F4A2F] text-white shadow-sm'
              : 'bg-[#FBFAF5] text-[#2B3A33] border border-[#E7E2D5] hover:bg-[#EAE5D9]'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-[#2BC55B]" />
          <span>{t('navAssignedCases')}</span>
          <span className="px-2 py-0.5 rounded-full bg-[#EAE5D9] text-[#0F4A2F] text-[10px] font-extrabold">
            {myAssignedCases.length}
          </span>
        </button>
      </div>

      {/* Queue Filters */}
      {activeTab === 'queue' && (
        <div className="bg-[#FBFAF5] p-4 rounded-3xl border border-[#E7E2D5] shadow-2xs mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#687C73] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#2B3A33] focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
            />
          </div>

          <div>
            <select
              value={filterCrop}
              onChange={(e) => setFilterCrop(e.target.value)}
              className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33] focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
            >
              <option value="All">-- {language === 'sw' ? 'Mazao Yote' : 'All Crops'} --</option>
              {COMMON_CROPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterSubCounty}
              onChange={(e) => setFilterSubCounty(e.target.value)}
              className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33] focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
            >
              <option value="All">-- {language === 'sw' ? 'Maeneo Bunge Yote' : 'All Sub-Counties'} --</option>
              {MACHAKOS_SUB_COUNTIES.map((sc) => (
                <option key={sc.name} value={sc.name}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Case List */}
      {loading ? (
        <div className="p-12 text-center text-[#52665C]">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0F4A2F] mb-2" />
          <p className="text-sm font-medium">{t('loading')}</p>
        </div>
      ) : activeTab === 'queue' ? (
        filteredQueue.length === 0 ? (
          <div className="bg-[#FBFAF5] rounded-3xl border border-[#E7E2D5] p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#DCFCE7] text-[#166534] flex items-center justify-center mx-auto mb-4 border border-[#86EFAC]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-black text-base text-[#0F4A2F] mb-1">
              {language === 'sw' ? 'Hakuna Kesi Zisizokabidhiwa' : 'Queue is empty'}
            </h3>
            <p className="text-xs sm:text-sm text-[#52665C] leading-relaxed">
              {language === 'sw'
                ? 'Kesi zote zilizowasilishwa zimekabidhiwa au kutatuliwa. Ripoti mpya zikija zitaonekana hapa.'
                : 'All submitted cases have been claimed or resolved. Check back soon for new farmer reports.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredQueue.map((item) => (
              <CaseCard
                key={item.id}
                caseItem={item}
                showClaimButton={true}
                onClaim={handleClaimCase}
                onOpen={(c) => setSelectedCase(c)}
              />
            ))}
          </div>
        )
      ) : myAssignedCases.length === 0 ? (
        <div className="bg-[#FBFAF5] rounded-3xl border border-[#E7E2D5] p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[#EAE5D9] text-[#0F4A2F] flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-[#2BC55B]" />
          </div>
          <h3 className="font-heading font-black text-base text-[#0F4A2F] mb-1">
            {language === 'sw' ? 'Hujakabidhiwa Kesi Yoyote Bado' : 'No assigned cases'}
          </h3>
          <p className="text-xs sm:text-sm text-[#52665C] mb-5 leading-relaxed">
            {language === 'sw'
              ? 'Tazama orodha ya kesi wazi na uchukue kesi za wakulima wanaohitaji usaidizi.'
              : 'Go to the unassigned queue to claim cases submitted by Machakos farmers.'}
          </p>
          <button
            onClick={() => setActiveTab('queue')}
            className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white font-bold text-xs shadow-sm inline-flex items-center gap-2"
          >
            <Inbox className="w-4 h-4 text-[#2BC55B]" />
            <span>{t('navOfficerQueue')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {myAssignedCases.map((item) => (
            <CaseCard key={item.id} caseItem={item} onOpen={(c) => setSelectedCase(c)} />
          ))}
        </div>
      )}

      {/* Case Details Drawer / Modal for Extension Officer */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FBFAF5] rounded-3xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl border border-[#E7E2D5] my-6 max-h-[90vh] flex flex-col animate-in fade-in duration-150">
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#0F4A2F] bg-[#EAE5D9] px-2.5 py-0.5 rounded-full">
                      <Sprout className="w-3.5 h-3.5 text-[#2BC55B]" />
                      <span>{selectedCase.crop}</span>
                    </span>
                    <span className="text-xs font-mono text-[#52665C]">
                      ID: {selectedCase.id.slice(0, 10)}
                    </span>
                    {Boolean(
                      currentUser && (
                        selectedCase.assignedOfficerId === currentUser.uid ||
                        isAdminUser ||
                        isSuperAdminUser ||
                        profile?.role === 'admin' ||
                        profile?.role === 'superadmin' ||
                        isUserSuperAdmin(currentUser.email)
                      )
                    ) && (
                      <button
                        onClick={() => setShowEditCropModal(true)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs transition-all"
                        title={language === 'sw' ? 'Sahihisha Zao' : 'Edit Crop'}
                      >
                        <Pencil className="w-3 h-3 text-amber-700" />
                        <span>{language === 'sw' ? 'Sahihisha Zao' : 'Edit Crop'}</span>
                      </button>
                    )}
                  </div>
                  <h3 className="font-heading font-black text-xl text-[#0F4A2F] mt-1">
                    {selectedCase.farmerName} • {selectedCase.subCounty}
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

            {/* Officer Action Bar */}
            <div className="py-3 px-4 bg-white rounded-2xl border border-[#E7E2D5] my-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#52665C] font-medium">Status:</span>
                <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                  {selectedCase.status}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(!selectedCase.assignedOfficerId || selectedCase.status === 'Submitted') && (
                  <button
                    onClick={() => handleClaimCase(selectedCase)}
                    disabled={claimingId === selectedCase.id}
                    className="min-h-[44px] px-4 py-2 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                  >
                    {claimingId === selectedCase.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t('claimCaseBtn')}
                  </button>
                )}

                <button
                  onClick={() => setShowDiagnosisModal(true)}
                  className="min-h-[44px] px-4 py-2 rounded-full bg-[#2BC55B] hover:bg-[#25ad50] text-[#0F4A2F] text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Stethoscope className="w-4 h-4 stroke-[2.5]" />
                  <span>{t('giveDiagnosisBtn')}</span>
                </button>

                {selectedCase.assignedOfficerId === currentUser?.uid && (
                  <button
                    onClick={() => setShowReassignModal(true)}
                    className="min-h-[44px] px-4 py-2 rounded-full border border-[#D5CFC0] bg-white hover:bg-[#EAE5D9] text-[#2B3A33] text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('reassignToQueueBtn')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable details & chat */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {/* Farmer Contact Info (Wrapped location) */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-heading font-black text-[#0F4A2F] block text-sm">{selectedCase.farmerName}</span>
                  <div className="flex flex-wrap items-center gap-3 text-[#52665C] mt-1">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-[#2BC55B]" />
                      <span>{selectedCase.farmerPhone}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#2BC55B]" />
                      <span>{selectedCase.subCounty} ({selectedCase.ward || 'Ward'}{selectedCase.village ? `, ${selectedCase.village}` : ''})</span>
                    </span>
                  </div>
                </div>
                <div className="text-right text-[#52665C]">
                  <span className="block">
                    Submitted: {formatDateKE(selectedCase.createdAt)}
                  </span>
                  <span>Noticed: {formatDateKE(selectedCase.dateFirstNoticed)}</span>
                </div>
              </div>

              {/* Photos (Loaded lazily from subcollection cases/{caseId}/photos) */}
              <CasePhotosViewer
                caseId={selectedCase.id}
                fallbackUrls={selectedCase.photoUrls}
                photoCount={selectedCase.photoCount}
                slotNames={selectedCase.slotNames}
                title={language === 'sw' ? 'Picha za Shambani' : 'Farmer Field Photos'}
              />

              {/* Farmer Symptoms */}
              <div>
                <h4 className="font-heading font-black text-xs uppercase tracking-wider text-[#0F4A2F] mb-1">
                  {t('symptomsLabel')}
                </h4>
                <p className="text-xs sm:text-sm text-[#2B3A33] bg-white p-4 rounded-2xl border border-[#E7E2D5] whitespace-pre-wrap leading-relaxed">
                  {selectedCase.symptomsDescription}
                </p>
              </div>

              {/* Existing Diagnosis if any */}
              {selectedCase.diagnosis && (
                <div className="p-4 rounded-2xl bg-[#DCFCE7]/60 border border-[#86EFAC] space-y-2 text-xs">
                  <h4 className="font-heading font-black text-[#0F4A2F] text-sm flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-[#2BC55B]" />
                    <span>{selectedCase.diagnosis.diseaseName}</span>
                  </h4>
                  <p className="text-[#2B3A33]">
                    <strong className="text-[#166534] block mb-0.5">{t('treatmentAdvice')}:</strong>
                    {selectedCase.diagnosis.treatmentAdvice}
                  </p>
                  {selectedCase.diagnosis.preventionTips && (
                    <p className="text-[#2B3A33]">
                      <strong className="text-[#166534] block mb-0.5">{t('preventionTips')}:</strong>
                      {selectedCase.diagnosis.preventionTips}
                    </p>
                  )}
                </div>
              )}

              {/* Real-time Consultation Chat */}
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

      {/* Diagnosis Modal */}
      {showDiagnosisModal && selectedCase && (
        <DiagnosisModal
          caseItem={selectedCase}
          onClose={() => setShowDiagnosisModal(false)}
          onSuccess={() => setShowDiagnosisModal(false)}
        />
      )}

      {/* Return to Queue Modal */}
      {showReassignModal && selectedCase && (
        <ReassignModal
          caseItem={selectedCase}
          mode="toQueue"
          onClose={() => setShowReassignModal(false)}
          onSuccess={() => {
            setShowReassignModal(false);
            setSelectedCase(null);
          }}
        />
      )}

      {/* Outbreak Alert Broadcasting Modal */}
      {showOutbreakModal && (
        <OutbreakAlertModal
          onClose={() => setShowOutbreakModal(false)}
          onSuccess={() => setShowOutbreakModal(false)}
        />
      )}

      {/* Edit Crop Modal */}
      {showEditCropModal && selectedCase && (
        <EditCropModal
          isOpen={showEditCropModal}
          onClose={() => setShowEditCropModal(false)}
          caseItem={selectedCase}
          onCropUpdated={(newCrop, updatedCase) => {
            setSelectedCase(updatedCase);
          }}
        />
      )}
    </div>
  );
};
