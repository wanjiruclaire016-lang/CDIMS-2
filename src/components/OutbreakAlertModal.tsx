import React, { useState, useEffect } from 'react';
import { OutbreakAlert, AlertSeverity } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MACHAKOS_SUB_COUNTIES, COMMON_CROPS } from '../utils/machakosData';
import { COMPREHENSIVE_DISEASE_CATALOG } from '../utils/diseaseDatabase';
import { doc, setDoc, addDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatDateKE } from '../utils/formatters';
import {
  ShieldAlert,
  X,
  Loader2,
  Send,
  Check,
  Plus,
  Trash2,
  Calendar,
  Phone,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Info,
} from 'lucide-react';

interface OutbreakAlertModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const OutbreakAlertModal: React.FC<OutbreakAlertModalProps> = ({ onClose, onSuccess }) => {
  const { profile, currentUser } = useAuth();
  const { t, language } = useLanguage();

  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Disease & Severity
  const [selectedDiseaseSlug, setSelectedDiseaseSlug] = useState<string>('maize-mlnd');
  const [customDiseaseName, setCustomDiseaseName] = useState<string>('');
  const [crop, setCrop] = useState<string>('Maize');
  const [severity, setSeverity] = useState<AlertSeverity>('Critical');

  // Step 2: Target Areas
  const [allMachakos, setAllMachakos] = useState<boolean>(true);
  const [selectedSubCounties, setSelectedSubCounties] = useState<string[]>([]);
  const [selectedWards, setSelectedWards] = useState<string[]>([]);

  // Step 3: Details & Contact
  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [actionItems, setActionItems] = useState<string[]>([
    'Inspect plants daily for early warning symptoms',
    'Report suspected sightings immediately to your local extension officer',
  ]);
  const [newActionInput, setNewActionInput] = useState<string>('');
  const [avoidItems, setAvoidItems] = useState<string[]>([
    'Do not transport infected cuttings or seedlings to other farms',
  ]);
  const [newAvoidInput, setNewAvoidInput] = useState<string>('');

  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [validUntil, setValidUntil] = useState<string>(nextMonth);
  const [officerPhone, setOfficerPhone] = useState<string>(profile?.phone || '0722000000');

  // Role check: Only verified extension officers, admins, or superadmin
  const isVerifiedOfficer =
    profile?.role === 'superadmin' ||
    profile?.role === 'admin' ||
    (profile?.role === 'officer' && profile?.officerStatus === 'verified');

  // On mount: Hide/resolve old test alert titled "urgent"
  useEffect(() => {
    async function hideOldTestAlert() {
      try {
        const alertsCol = collection(db, 'alerts');
        const snap = await getDocs(alertsCol);
        snap.forEach(async (d) => {
          const data = d.data();
          const titleLower = (data.title || '').toLowerCase();
          if (titleLower.includes('urgent') && data.active === true) {
            await updateDoc(doc(db, 'alerts', d.id), {
              active: false,
              status: 'Resolved',
            });
          }
        });
      } catch (err) {
        console.warn('Could not auto-resolve legacy urgent alert:', err);
      }
    }
    hideOldTestAlert();
  }, []);

  // Update crop when disease selection changes
  const handleDiseaseChange = (slug: string) => {
    setSelectedDiseaseSlug(slug);
    const found = COMPREHENSIVE_DISEASE_CATALOG.find((d) => d.slug === slug);
    if (found) {
      setCrop(found.crop);
      if (!title) {
        setTitle(`${found.nameEn} Outbreak Advisory`);
      }
    }
  };

  const handleAddActionItem = () => {
    if (newActionInput.trim() && actionItems.length < 6) {
      setActionItems([...actionItems, newActionInput.trim()]);
      setNewActionInput('');
    }
  };

  const handleRemoveActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  const handleAddAvoidItem = () => {
    if (newAvoidInput.trim() && avoidItems.length < 6) {
      setAvoidItems([...avoidItems, newAvoidInput.trim()]);
      setNewAvoidInput('');
    }
  };

  const handleRemoveAvoidItem = (index: number) => {
    setAvoidItems(avoidItems.filter((_, i) => i !== index));
  };

  const toggleSubCounty = (name: string) => {
    if (selectedSubCounties.includes(name)) {
      setSelectedSubCounties(selectedSubCounties.filter((s) => s !== name));
    } else {
      setSelectedSubCounties([...selectedSubCounties, name]);
    }
  };

  // Validation
  const canProceedStep1 = selectedDiseaseSlug !== 'custom' || customDiseaseName.trim() !== '';
  const canProceedStep2 = allMachakos || selectedSubCounties.length > 0;
  const canProceedStep3 =
    title.trim().length >= 10 &&
    summary.trim().length >= 30 &&
    actionItems.length >= 1 &&
    officerPhone.trim() !== '';

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1 && !canProceedStep1) {
      setErrorMsg('Please choose a valid disease or provide its name.');
      return;
    }
    if (step === 2 && !canProceedStep2) {
      setErrorMsg('Please select at least one target sub-county or choose All Machakos County.');
      return;
    }
    if (step === 3 && !canProceedStep3) {
      setErrorMsg(
        'Please ensure Title has min 10 chars, Summary has min 30 chars, and at least 1 action item is present.'
      );
      return;
    }
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const handleSubmit = async () => {
    if (!isVerifiedOfficer || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const diseaseObj = COMPREHENSIVE_DISEASE_CATALOG.find((d) => d.slug === selectedDiseaseSlug);
    const diseaseName = selectedDiseaseSlug === 'custom' ? customDiseaseName.trim() : diseaseObj?.nameEn || selectedDiseaseSlug;

    const primarySubCounty = allMachakos
      ? 'All Machakos County'
      : selectedSubCounties.join(', ');

    const newAlert: OutbreakAlert = {
      id: alertId,
      title: title.trim(),
      crop,
      diseaseSlug: selectedDiseaseSlug === 'custom' ? undefined : selectedDiseaseSlug,
      diseaseName,
      severity,
      status: 'Active',
      subCounty: primarySubCounty,
      subCounties: allMachakos ? ['All Machakos'] : selectedSubCounties,
      wards: selectedWards,
      allMachakos,
      summary: summary.trim(),
      message: summary.trim(),
      actionItems,
      avoidItems,
      officerId: currentUser?.uid || '',
      officerName: profile?.fullName || 'Extension Officer',
      officerPhone: officerPhone.trim(),
      validUntil,
      active: true,
      acknowledgementCount: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      // 1. Create in Firestore alerts collection
      await setDoc(doc(db, 'alerts', alertId), newAlert);

      // 2. Audit log entry
      if (currentUser) {
        await addDoc(collection(db, 'auditLogs'), {
          actorId: currentUser.uid,
          actorName: profile?.fullName || 'Extension Officer',
          actorEmail: currentUser.email || '',
          action: 'issue_outbreak_alert',
          targetId: alertId,
          targetType: 'alert',
          details: `Issued ${severity} Outbreak Alert for ${diseaseName} across ${primarySubCounty}`,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }

      // 3. TODO: Connect SMS Cloud Function queue (e.g. Africa's Talking / Safaricom bulk SMS dispatch to subscribed farmers in affected wards)
      /*
       * TODO: Cloud Function trigger `onOutbreakAlertCreated`:
       * 1. Query verified farmers in target subCounties matching the crop.
       * 2. Format localized SMS in Swahili & English.
       * 3. Dispatch via SMS gateway queue.
       */

      onSuccess();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `alerts/${alertId}`);
      setErrorMsg('Failed to broadcast alert. Please check your network connection.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isVerifiedOfficer) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-[#FBFAF5] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E2D5] text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-black text-lg text-[#0F4A2F]">
            Officer Verification Required
          </h3>
          <p className="text-xs text-[#52665C] leading-relaxed">
            Only verified agricultural extension officers and CropCare Centre administrators can broadcast official outbreak alerts.
          </p>
          <button
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-full bg-[#0F4A2F] text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FBFAF5] w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl rounded-none sm:rounded-3xl border border-[#E7E2D5] shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header & Steps */}
        <div className="bg-[#FBFAF5] border-b border-[#E7E2D5] px-4 sm:px-6 pt-4 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-[#2BC55B]" />
              </div>
              <div>
                <h3 className="font-heading font-black text-base text-[#0F4A2F]">
                  {t('officerOutbreakModalTitle')}
                </h3>
                <p className="text-[11px] text-[#52665C]">CropCare Centre, Machakos County</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#52665C] hover:bg-[#EAE5D9] hover:text-[#0F4A2F]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-[#0F4A2F] mb-1.5">
              <span>
                {t('stepLabel')} {step} {t('ofLabel')} 4
              </span>
              <span className="text-[#687C73] font-medium">
                {step === 1 && t('alertStep1')}
                {step === 2 && t('alertStep2')}
                {step === 3 && t('alertStep3')}
                {step === 4 && t('alertStep4')}
              </span>
            </div>
            <div className="w-full bg-[#EAE5D9] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#2BC55B] h-full transition-all duration-300 rounded-full"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: DISEASE & SEVERITY */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] mb-1.5">
                  Select Disease from Verified Library *
                </label>
                <select
                  value={selectedDiseaseSlug}
                  onChange={(e) => handleDiseaseChange(e.target.value)}
                  className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                >
                  {COMPREHENSIVE_DISEASE_CATALOG.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.crop}: {d.nameEn} ({d.nameSw})
                    </option>
                  ))}
                  <option value="custom">-- Custom Uncatalogued Disease / Pest --</option>
                </select>
              </div>

              {selectedDiseaseSlug === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                    Custom Disease Name *
                  </label>
                  <input
                    type="text"
                    value={customDiseaseName}
                    onChange={(e) => setCustomDiseaseName(e.target.value)}
                    placeholder="e.g. Swarming Locusts, Desert Locust swarm"
                    className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2 text-xs sm:text-sm text-[#2B3A33]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] mb-1.5">Host Crop *</label>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33]"
                >
                  {COMMON_CROPS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Three Calm Levels: Advisory (amber), Warning (orange), Critical (red) */}
              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] mb-1.5">
                  Severity Level *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Advisory', label: t('severityAdvisory'), color: 'bg-amber-50 text-amber-900 border-amber-300' },
                    { id: 'Warning', label: t('severityWarning'), color: 'bg-orange-50 text-orange-900 border-orange-300' },
                    { id: 'Critical', label: t('severityCritical'), color: 'bg-red-50 text-red-900 border-red-300' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeverity(s.id as AlertSeverity)}
                      className={`min-h-[48px] p-2.5 rounded-2xl border text-xs font-bold transition-all text-center ${
                        severity === s.id
                          ? `${s.color} ring-2 ring-current shadow-xs`
                          : 'bg-white border-[#E7E2D5] text-[#52665C] hover:bg-[#EAE5D9]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TARGET AREAS */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-heading font-black text-sm text-[#0F4A2F]">
                  Target County / Sub-Counties
                </h4>
                <p className="text-xs text-[#52665C]">
                  Select whether this alert applies county-wide or to specific sub-counties.
                </p>
              </div>

              {/* All Machakos Option */}
              <button
                type="button"
                onClick={() => {
                  setAllMachakos(!allMachakos);
                  if (!allMachakos) setSelectedSubCounties([]);
                }}
                className={`w-full min-h-[48px] p-3.5 rounded-2xl border text-left flex items-center justify-between font-bold text-xs transition-all ${
                  allMachakos
                    ? 'bg-[#DCFCE7] border-[#2BC55B] text-[#166534] ring-2 ring-[#2BC55B]'
                    : 'bg-white border-[#E7E2D5] text-[#2B3A33] hover:bg-[#EAE5D9]'
                }`}
              >
                <span>All Machakos County (County-wide Broadcast)</span>
                {allMachakos && <Check className="w-4 h-4 text-[#166534]" />}
              </button>

              {!allMachakos && (
                <div>
                  <label className="block text-xs font-bold text-[#0F4A2F] mb-1.5">
                    Select Target Sub-Counties:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {MACHAKOS_SUB_COUNTIES.map((sc) => {
                      const selected = selectedSubCounties.includes(sc.name);
                      return (
                        <button
                          key={sc.name}
                          type="button"
                          onClick={() => toggleSubCounty(sc.name)}
                          className={`min-h-[48px] p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                            selected
                              ? 'bg-[#0F4A2F] text-white shadow-xs'
                              : 'bg-white border-[#E7E2D5] text-[#2B3A33] hover:bg-[#EAE5D9]'
                          }`}
                        >
                          <span className="truncate">{sc.name}</span>
                          {selected && <Check className="w-3.5 h-3.5 text-[#2BC55B]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: DETAILS, CHECKLIST, CONTACT */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                  {t('alertTitleInputLabel')} *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Fall Armyworm infestation reported in Kangundo and Kathiani"
                  className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                  {t('alertSummaryInputLabel')} *
                </label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Explain what is happening in the fields, current infection rate, weather conditions..."
                  className="w-full bg-white border border-[#D5CFC0] rounded-2xl p-3 text-xs sm:text-sm text-[#2B3A33]"
                />
              </div>

              {/* Action Checklist (What to do now - up to 6 items) */}
              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                  {t('actionChecklistLabel')} ({actionItems.length}/6)
                </label>
                <div className="space-y-2 mb-2">
                  {actionItems.map((item, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-white border border-[#E7E2D5] flex items-center justify-between gap-2 text-xs"
                    >
                      <span>
                        {i + 1}. {item}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveActionItem(i)}
                        className="text-[#687C73] hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {actionItems.length < 6 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newActionInput}
                      onChange={(e) => setNewActionInput(e.target.value)}
                      placeholder="Add an action step..."
                      className="flex-1 min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddActionItem}
                      className="min-h-[44px] px-3.5 rounded-xl bg-[#0F4A2F] text-white text-xs font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* What to avoid */}
              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                  {t('avoidListLabel')} ({avoidItems.length}/6)
                </label>
                <div className="space-y-2 mb-2">
                  {avoidItems.map((item, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-white border border-[#E7E2D5] flex items-center justify-between gap-2 text-xs"
                    >
                      <span>• {item}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAvoidItem(i)}
                        className="text-[#687C73] hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {avoidItems.length < 6 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAvoidInput}
                      onChange={(e) => setNewAvoidInput(e.target.value)}
                      placeholder="Add an item to avoid..."
                      className="flex-1 min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddAvoidItem}
                      className="min-h-[44px] px-3.5 rounded-xl bg-[#0F4A2F] text-white text-xs font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Valid until date & Officer contact phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                    {t('validUntilDateLabel')} *
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                    {t('officerPhoneLabel')} *
                  </label>
                  <input
                    type="tel"
                    value={officerPhone}
                    onChange={(e) => setOfficerPhone(e.target.value)}
                    className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW & CONFIRM */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-heading font-black text-xl text-[#0F4A2F]">
                  Preview Alert Before Broadcast
                </h4>
                <p className="text-xs text-[#52665C]">
                  This will broadcast to all registered farmers in the target sub-counties.
                </p>
              </div>

              {/* Preview Card */}
              <div className="p-4 rounded-3xl bg-white border border-[#E7E2D5] space-y-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEE2E2] text-[#991B1B]">
                    {severity}
                  </span>
                  <span className="text-xs font-semibold text-[#0F4A2F] bg-[#EAE5D9] px-2.5 py-0.5 rounded-full">
                    {crop}
                  </span>
                  <span className="text-xs text-[#52665C]">
                    {allMachakos ? 'All Machakos County' : selectedSubCounties.join(', ')}
                  </span>
                </div>

                <h3 className="font-heading font-black text-base text-[#0F4A2F]">{title}</h3>

                <p className="text-xs text-[#2B3A33] leading-relaxed whitespace-pre-line">
                  {summary}
                </p>

                <div className="pt-2 border-t border-[#E7E2D5] text-xs text-[#52665C] space-y-1">
                  <p>
                    <span className="font-bold text-[#0F4A2F]">What to do:</span>{' '}
                    {actionItems.join('; ')}
                  </p>
                  <p>
                    <span className="font-bold text-[#0F4A2F]">Contact phone:</span> {officerPhone}
                  </p>
                  <p>
                    <span className="font-bold text-[#0F4A2F]">Valid until:</span>{' '}
                    {formatDateKE(validUntil)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-[#FBFAF5] border-t border-[#E7E2D5] px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="min-h-[48px] px-5 py-2.5 rounded-full border border-[#D5CFC0] bg-white text-[#2B3A33] text-xs font-bold flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4 text-[#2BC55B]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#DC2626] hover:bg-[#b91c1c] text-white text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{t('confirmBroadcastAlert')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
