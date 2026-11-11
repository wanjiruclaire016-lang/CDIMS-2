import React, { useState } from 'react';
import { CaseItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { SUBMIT_CASE_CROPS } from '../utils/machakosData';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { X, Sprout, AlertCircle, Loader2, Check, Info } from 'lucide-react';

interface EditCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: CaseItem;
  onCropUpdated?: (newCrop: string, updatedCase: CaseItem) => void;
}

export const EditCropModal: React.FC<EditCropModalProps> = ({
  isOpen,
  onClose,
  caseItem,
  onCropUpdated,
}) => {
  const { currentUser, profile, recordAuditLog } = useAuth();
  const { t, language } = useLanguage();

  const isExistingPreset = SUBMIT_CASE_CROPS.some(
    (c) => c !== 'Other' && c.toLowerCase() === caseItem.crop.toLowerCase()
  );

  const [selectedCrop, setSelectedCrop] = useState<string>(
    isExistingPreset ? caseItem.crop : 'Other'
  );
  const [customCrop, setCustomCrop] = useState<string>(
    isExistingPreset ? '' : caseItem.crop
  );
  const [correctionNote, setCorrectionNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const effectiveCrop = selectedCrop === 'Other' ? customCrop.trim() : selectedCrop;

    if (!effectiveCrop) {
      setError(
        language === 'sw'
          ? 'Tafadhali chagua au uandike zao lililosahihishwa.'
          : 'Please select or enter the corrected crop name.'
      );
      return;
    }

    if (effectiveCrop.toLowerCase() === caseItem.crop.toLowerCase()) {
      setError(
        language === 'sw'
          ? `Zao lililochaguliwa ni "${caseItem.crop}" tayari. Chagua zao jipya lililosahihishwa.`
          : `The crop is already set to "${caseItem.crop}". Please select a different crop to correct.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    const nowIso = new Date().toISOString();
    const officerName =
      profile?.fullName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Extension Officer';

    try {
      // 1. Update case document in Firestore
      const caseRef = doc(db, 'cases', caseItem.id);
      const updatedFields = {
        crop: effectiveCrop,
        previousCrop: caseItem.crop,
        cropCorrectedBy: officerName,
        cropCorrectedAt: nowIso,
        updatedAt: nowIso,
      };

      await updateDoc(caseRef, updatedFields);

      // 2. Record in audit log
      const auditDetails = `Crop for case #${caseItem.id.slice(0, 8)} corrected from "${caseItem.crop}" to "${effectiveCrop}" by ${officerName}${
        correctionNote.trim() ? ` (Note: ${correctionNote.trim()})` : ''
      }`;

      await recordAuditLog('CROP_CORRECTED', caseItem.id, auditDetails);

      const logId = `log_crop_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      try {
        await setDoc(doc(db, 'auditLogs', logId), {
          id: logId,
          actorId: currentUser.uid,
          actorName: officerName,
          actorEmail: currentUser.email || '',
          action: 'CROP_CORRECTED',
          targetId: caseItem.id,
          details: auditDetails,
          timestamp: nowIso,
        });
      } catch (err) {
        console.warn('Audit log direct write note:', err);
      }

      // 3. Post system message to case consultation thread
      const msgId = `sys_crop_${Date.now()}`;
      try {
        await setDoc(doc(db, 'cases', caseItem.id, 'messages', msgId), {
          id: msgId,
          caseId: caseItem.id,
          senderId: currentUser.uid,
          senderName: officerName,
          senderRole: 'system',
          text:
            language === 'sw'
              ? `Ilani: Zao la kesi hii limesahihishwa kutoka "${caseItem.crop}" hadi "${effectiveCrop}" na ${officerName}.${
                  correctionNote.trim() ? ` Sababu: ${correctionNote.trim()}` : ''
                }`
              : `Notice: Crop for this case was corrected from "${caseItem.crop}" to "${effectiveCrop}" by ${officerName}.${
                  correctionNote.trim() ? ` Reason: ${correctionNote.trim()}` : ''
                }`,
          createdAt: nowIso,
        });
      } catch (err) {
        console.warn('Case thread message write note:', err);
      }

      // 4. Create notification for the farmer
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      try {
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: caseItem.farmerId,
          caseId: caseItem.id,
          title: language === 'sw' ? 'Zao Limesahihishwa' : 'Crop Corrected',
          message:
            language === 'sw'
              ? `Zao kwenye kesi yako #${caseItem.id.slice(0, 8)} limesahihishwa kutoka ${caseItem.crop} hadi ${effectiveCrop} na ${officerName}.`
              : `The crop on your case #${caseItem.id.slice(0, 8)} was corrected from ${caseItem.crop} to ${effectiveCrop} by ${officerName}.`,
          type: 'crop_corrected',
          read: false,
          createdAt: nowIso,
          officerName,
          previousCrop: caseItem.crop,
          newCrop: effectiveCrop,
        });
      } catch (err) {
        console.warn('Notification write note:', err);
      }

      const updatedCase: CaseItem = {
        ...caseItem,
        ...updatedFields,
      };

      if (onCropUpdated) {
        onCropUpdated(effectiveCrop, updatedCase);
      }

      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${caseItem.id}`);
      setError(
        language === 'sw'
          ? 'Imeshindikana kusahihisha zao. Tafadhali jaribu tena.'
          : 'Failed to update crop. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FBFAF5] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E7E2D5] my-8 animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E2D5] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#0F4A2F] text-white flex items-center justify-center">
              <Sprout className="w-5 h-5 text-[#2BC55B]" />
            </div>
            <div>
              <h3 className="font-heading font-black text-base text-[#0F4A2F]">
                {language === 'sw' ? 'Sahihisha Zao la Kesi' : 'Edit / Correct Case Crop'}
              </h3>
              <p className="text-xs text-[#52665C]">
                Case ID: <span className="font-mono text-[#2B3A33]">{caseItem.id.slice(0, 8)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#52665C] hover:bg-[#EAE5D9] hover:text-[#0F4A2F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#991B1B] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Crop Banner */}
        <div className="p-3 mb-4 rounded-2xl bg-white border border-[#E7E2D5] text-xs flex items-center justify-between">
          <span className="text-[#52665C] font-medium">
            {language === 'sw' ? 'Zao la Sasa:' : 'Current Crop:'}
          </span>
          <span className="font-bold text-[#0F4A2F] bg-[#EAE5D9] px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5 text-[#2BC55B]" />
            <span>{caseItem.crop}</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1.5">
              {language === 'sw' ? 'Chagua Zao Sahihi' : 'Select Corrected Crop'} *
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => {
                setSelectedCrop(e.target.value);
                if (error) setError(null);
              }}
              required
              className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B] mb-2 font-medium"
            >
              <option value="" disabled>
                {language === 'sw' ? '-- Chagua zao --' : '-- Select crop --'}
              </option>
              {SUBMIT_CASE_CROPS.map((cropOption) => (
                <option key={cropOption} value={cropOption}>
                  {cropOption}
                </option>
              ))}
            </select>

            {selectedCrop === 'Other' && (
              <div className="mt-2">
                <label className="block text-xs font-semibold text-[#0F4A2F] mb-1">
                  {language === 'sw' ? 'Taja Zao Lililosahihishwa' : 'Specify Corrected Crop Name'} *
                </label>
                <input
                  type="text"
                  value={customCrop}
                  onChange={(e) => {
                    setCustomCrop(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                  placeholder={
                    language === 'sw'
                      ? 'K.m. Parachichi, Kahawa, Mtama...'
                      : 'e.g. Avocado, Sweet Potato, Mango...'
                  }
                  className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1.5">
              {language === 'sw' ? 'Maelezo ya Ziada (Hiari)' : 'Reason / Note for Correction (Optional)'}
            </label>
            <textarea
              rows={2}
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder={
                language === 'sw'
                  ? 'K.m. Picha zinaonyesha dalili za nyanya badala ya viazi...'
                  : 'e.g. Photo inspection indicates tomato foliage, not potato...'
              }
              className="w-full bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2 text-xs text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
            />
          </div>

          <div className="p-3 rounded-2xl bg-[#EAE5D9]/70 border border-[#D5CFC0] text-[11px] text-[#2B3A33] space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-[#0F4A2F]">
              <Info className="w-3.5 h-3.5 text-[#2BC55B]" />
              <span>{language === 'sw' ? 'Taarifa ya Mabadiliko:' : 'Audit & Notification Policy:'}</span>
            </p>
            <p className="leading-relaxed">
              {language === 'sw'
                ? 'Mabadiliko haya yataonyeshwa kwenye kesi ("Zao lilisahihishwa na..."), yatanakiliwa kwenye kumbukumbu ya ukaguzi (Audit Log), na mkulima atapokea arifa.'
                : 'This action displays a note on the case ("Crop corrected by [your name]"), logs an entry in the audit trail, and sends a notification to the farmer.'}
            </p>
          </div>

          <div className="pt-3 border-t border-[#E7E2D5] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-[44px] px-4 py-2 rounded-full border border-[#D5CFC0] text-[#2B3A33] hover:bg-[#EAE5D9] text-xs font-semibold"
            >
              {t('cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-5 py-2 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === 'sw' ? 'Inahifadhi...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-[#2BC55B]" />
                  <span>{language === 'sw' ? 'Hifadhi Mabadiliko' : 'Save Correction'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
